import dotenv from 'dotenv'
dotenv.config()

import { getRedisClient } from '../redis/personal'
import { getIndexConstituents } from '../fetchers/constituents'
import { NIFTY_50_INDEX_CODE } from '../config/global'
import { ohlcKey, technicalsKey, newsKey, runConfigKey, tickSnapshotKey, leaderboardKey, modelStateKey, modelOrdersKey, modelTradesKey } from '../config/redis'
import { getSymbolFromMBCode } from '../utils/codes'
import { OHLC, RunConfig, StockSignal, TickSnapshot } from '../types/global'
import { Portfolio } from '../classes/portfolio'
import { Simulator } from '../classes/simulator'
import { CrossSectionalRanker } from '../classes/cross-sectional'
import { GeminiFlashAdapter, LLMOrchestrator, MockLLMAdapter } from '../classes/llm'
import { Technicals } from '../classes/technicals'

// ── Configuration ────────────────────────────────────────────────────────

const RUN_CONFIG = {
    runId: `run_${Date.now()}`,
    startingCapital: 10_00_000,
    // Use mock LLM for testing, set USE_REAL_LLM=true to use Gemini Flash
    useRealLLM: process.env.USE_REAL_LLM === 'true',
}

// ── Main Arena Runner ────────────────────────────────────────────────────

async function main() {
    console.log('═══════════════════════════════════════════════════════')
    console.log('       🏟️  LLM TRADING ARENA — BACKTEST REPLAY')
    console.log('═══════════════════════════════════════════════════════')
    console.log(`Run ID: ${RUN_CONFIG.runId}`)
    console.log(`Mode: ${RUN_CONFIG.useRealLLM ? 'LIVE (Gemini Flash)' : 'MOCK LLM (testing)'}`)
    console.log()

    const client = await getRedisClient()

    try {
        // Step 1: Load universe
        console.log('[1/6] Loading Nifty 50 constituents...')
        const mbCodes = await getIndexConstituents(NIFTY_50_INDEX_CODE)
        const symbolMap = await getSymbolFromMBCode(mbCodes)
        console.log(`  Loaded ${mbCodes.length} stocks`)

        // Step 2: Load OHLC data from Redis
        console.log('[2/6] Loading OHLC data from Redis...')
        const allOhlc: Record<string, OHLC[]> = {}
        let minDays = Infinity

        for (const mbCode of mbCodes) {
            const raw = await client.get(ohlcKey(mbCode, '1Y'))
            if (!raw) {
                console.warn(`  No OHLC data for ${mbCode} (${symbolMap[mbCode]}), skipping`)
                continue
            }
            const ohlc: OHLC[] = JSON.parse(raw)
            ohlc.sort((a: OHLC, b: OHLC) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
            allOhlc[mbCode] = ohlc
            minDays = Math.min(minDays, ohlc.length)
        }

        const stockCodes = Object.keys(allOhlc)
        console.log(`  Loaded OHLC for ${stockCodes.length} stocks (min ${minDays} days)`)

        if (stockCodes.length === 0) {
            console.error('No OHLC data found! Run `npm run play` first to seed data.')
            return
        }

        // Step 3: Extract trading day timeline
        // Use the stock with the most data as the reference timeline
        const refCode = stockCodes.reduce((a, b) => allOhlc[a].length > allOhlc[b].length ? a : b)
        const allDates = allOhlc[refCode].map(d => new Date(d.datetime).toISOString().split('T')[0])

        // We need at least 60 days of lookback for technicals, then simulate the remaining days
        const LOOKBACK = 60
        if (allDates.length < LOOKBACK + 10) {
            console.error(`Not enough data for simulation. Need at least ${LOOKBACK + 10} days, have ${allDates.length}`)
            return
        }

        const simStartIdx = LOOKBACK
        const tradingDays = allDates.slice(simStartIdx)
        console.log(`  Simulating ${tradingDays.length} trading days (${tradingDays[0]} → ${tradingDays[tradingDays.length - 1]})`)

        // Step 4: Initialize models
        console.log('[3/6] Initializing models...')
        const adapter = RUN_CONFIG.useRealLLM
            ? new GeminiFlashAdapter('gemini-flash')
            : new MockLLMAdapter('mock-llm')

        const modelId = adapter.modelId
        const portfolio = new Portfolio(modelId, RUN_CONFIG.runId, RUN_CONFIG.startingCapital)
        const orchestrator = new LLMOrchestrator(adapter, stockCodes)
        const simulator = new Simulator()
        const ranker = new CrossSectionalRanker()

        console.log(`  Model: ${modelId}`)
        console.log(`  Starting Capital: ₹${RUN_CONFIG.startingCapital.toLocaleString('en-IN')}`)
        console.log()

        // Step 5: Save run config to Redis
        const runConfig: RunConfig = {
            runId: RUN_CONFIG.runId,
            startDate: tradingDays[0],
            endDate: tradingDays[tradingDays.length - 1],
            models: [{ modelId, provider: adapter.constructor.name }],
            startingCapital: RUN_CONFIG.startingCapital,
            maxPositions: 10,
            maxPositionPct: 20,
            brokerageBps: 10,
            slippageBps: 5,
        }
        await client.set(runConfigKey(RUN_CONFIG.runId), JSON.stringify(runConfig))

        // Load news data (pre-cached, one-time load)
        console.log('[4/6] Loading news data...')
        const newsData: Record<string, string> = {}
        for (const mbCode of stockCodes) {
            const raw = await client.get(newsKey(mbCode))
            if (raw) {
                try {
                    const articles = JSON.parse(raw)
                    // Extract just headlines for compact context
                    if (Array.isArray(articles) && articles.length > 0) {
                        newsData[mbCode] = articles
                            .slice(0, 3)
                            .map((a: any) => a.title || a.headline || '')
                            .filter(Boolean)
                            .join('; ')
                    }
                } catch { /* skip bad news data */ }
            }
        }
        console.log(`  Loaded news for ${Object.keys(newsData).length} stocks`)

        // ── SIMULATION LOOP ──────────────────────────────────────────────

        console.log()
        console.log('[5/6] Starting simulation...')
        console.log('─'.repeat(80))

        let pendingOrders: { modelId: string, orders: import('../types/global').Order[] }[] = []

        for (let dayIdx = 0; dayIdx < tradingDays.length - 1; dayIdx++) {
            const today = tradingDays[dayIdx]
            const tomorrow = tradingDays[dayIdx + 1]
            const dataEndIdx = simStartIdx + dayIdx + 1  // index into allDates (inclusive)

            console.log(`\n📅 Day ${dayIdx + 1}/${tradingDays.length - 1}: ${today}`)

            // ── EXECUTION PHASE (fill yesterday's orders at today's open) ──

            if (pendingOrders.length > 0) {
                console.log('  ⚡ Executing pending orders at today\'s open...')
                const todayOpenPrices: Record<string, number> = {}
                for (const mbCode of stockCodes) {
                    const ohlc = allOhlc[mbCode]
                    const todayCandle = ohlc.find(d =>
                        new Date(d.datetime).toISOString().split('T')[0] === today
                    )
                    if (todayCandle) {
                        todayOpenPrices[mbCode] = todayCandle.open
                    }
                }

                for (const pending of pendingOrders) {
                    const trades = simulator.executeOrders(
                        pending.orders,
                        todayOpenPrices,
                        portfolio,
                        today,
                    )

                    // Save trades to Redis
                    if (trades.length > 0) {
                        const tradesKey = modelTradesKey(RUN_CONFIG.runId, pending.modelId)
                        const existing = await client.get(tradesKey)
                        const allTrades = existing ? JSON.parse(existing) : []
                        allTrades.push(...trades)
                        await client.set(tradesKey, JSON.stringify(allTrades))
                    }
                }
                pendingOrders = []
            }

            // ── FEATURE PHASE (compute technicals using data up to today) ──

            const closePrices: Record<string, number> = {}
            const ohlcWindows: Record<string, OHLC[]> = {}

            for (const mbCode of stockCodes) {
                const ohlc = allOhlc[mbCode]
                // Only use data up to and including today (no look-ahead)
                const window = ohlc.filter(d =>
                    new Date(d.datetime).toISOString().split('T')[0] <= today
                )
                ohlcWindows[mbCode] = window

                const lastCandle = window[window.length - 1]
                if (lastCandle) {
                    closePrices[mbCode] = lastCandle.close
                }
            }

            // Mark-to-market using today's close
            portfolio.markToMarket(closePrices)

            // Compute cross-sectional ranks
            const xsecRanks = ranker.compute(ohlcWindows, today)

            // Build stock signals for the LLM
            const stockSignals: StockSignal[] = []
            for (const mbCode of stockCodes) {
                const window = ohlcWindows[mbCode]
                if (!window || window.length < 15) continue

                const tech = new Technicals(window)
                const returns = tech.getReturns()
                const rsi = tech.getRSI()
                const macd = tech.getMACD()
                const regime = tech.getRegimeClass()
                const ranking = xsecRanks.rankings[mbCode]

                stockSignals.push({
                    symbol: symbolMap[mbCode] || mbCode,
                    mbCode,
                    close: closePrices[mbCode] ?? 0,
                    returns,
                    rsi: rsi.value as number | null,
                    macdSignal: macd.action,
                    regime,
                    momentumRank1m: ranking?.momentumRank1m ?? null,
                    riskFlag: ranking?.riskFlag ?? false,
                    newsSummary: newsData[mbCode] || '',
                })
            }

            // ── DECISION PHASE (ask LLM) ─────────────────────────────────

            console.log(`  🤖 Asking ${modelId} for trading decisions...`)
            const portfolioState = portfolio.getState()
            const decision = await orchestrator.getDecision(
                today,
                portfolioState,
                stockSignals,
                xsecRanks,
                symbolMap,
            )

            console.log(`  📋 Decision: ${decision.orders.length} orders, confidence=${decision.confidence}`)
            if (decision.rationale) {
                console.log(`  💭 Rationale: ${decision.rationale.substring(0, 120)}...`)
            }

            // Validate orders against portfolio risk limits
            const validatedOrders = portfolio.validateOrders(decision.orders)
            console.log(`  ✅ ${validatedOrders.length}/${decision.orders.length} orders passed validation`)

            // Queue for tomorrow's execution
            if (validatedOrders.length > 0) {
                pendingOrders.push({ modelId, orders: validatedOrders })
            }

            // Save orders to Redis
            const ordersKey = modelOrdersKey(RUN_CONFIG.runId, modelId)
            const existingOrders = await client.get(ordersKey)
            const allOrders = existingOrders ? JSON.parse(existingOrders) : []
            allOrders.push({ date: today, orders: validatedOrders, rationale: decision.rationale })
            await client.set(ordersKey, JSON.stringify(allOrders))

            // ── SCORING PHASE ────────────────────────────────────────────

            const state = portfolio.getState()
            console.log(`  📊 NAV: ₹${state.nav.toLocaleString('en-IN')} | Return: ${state.totalReturn}% | DD: ${state.maxDrawdown}% | Score: ${state.score}`)

            // Save state snapshot
            await client.set(modelStateKey(RUN_CONFIG.runId, modelId), JSON.stringify(state))

            // Save tick snapshot
            const marketData: Record<string, { close: number; open: number }> = {}
            for (const mbCode of stockCodes) {
                const ohlc = allOhlc[mbCode]
                const todayCandle = ohlc.find(d =>
                    new Date(d.datetime).toISOString().split('T')[0] === today
                )
                if (todayCandle) {
                    marketData[mbCode] = { close: todayCandle.close, open: todayCandle.open }
                }
            }

            const tickSnapshot: TickSnapshot = {
                runId: RUN_CONFIG.runId,
                tickDate: today,
                marketData,
                modelStates: { [modelId]: state },
                modelOrders: { [modelId]: validatedOrders },
                modelTrades: {},
                leaderboard: [{ modelId, score: state.score, nav: state.nav }],
            }
            await client.set(tickSnapshotKey(RUN_CONFIG.runId, today), JSON.stringify(tickSnapshot))

            // Add a small delay when using real LLM to respect rate limits
            if (RUN_CONFIG.useRealLLM) {
                await new Promise(resolve => setTimeout(resolve, 2000))
            }
        }

        // ── FINAL RESULTS ────────────────────────────────────────────────

        console.log()
        console.log('═'.repeat(80))
        console.log('  🏆 FINAL RESULTS')
        console.log('═'.repeat(80))

        const finalState = portfolio.getState()
        console.log(`  Model: ${finalState.modelId}`)
        console.log(`  Final NAV: ₹${finalState.nav.toLocaleString('en-IN')}`)
        console.log(`  Total Return: ${finalState.totalReturn}%`)
        console.log(`  Max Drawdown: ${finalState.maxDrawdown}%`)
        console.log(`  Turnover Cost: ${finalState.turnoverCostPct}%`)
        console.log(`  Score: ${finalState.score}`)
        console.log(`  Open Positions: ${finalState.positions.length}`)
        console.log()

        if (finalState.positions.length > 0) {
            console.log('  Positions:')
            for (const p of finalState.positions) {
                console.log(`    ${p.symbol}: ${p.quantity} shares @ ₹${p.avgCost} → ₹${p.currentPrice} (${p.unrealizedPnL > 0 ? '+' : ''}₹${p.unrealizedPnL})`)
            }
        }

        // Save final leaderboard
        const leaderboard = [{ modelId: finalState.modelId, score: finalState.score, nav: finalState.nav }]
        await client.set(leaderboardKey(RUN_CONFIG.runId), JSON.stringify(leaderboard))

        console.log()
        console.log(`Run data saved to Redis under key prefix: run:${RUN_CONFIG.runId}:*`)
        console.log('═'.repeat(80))

    } finally {
        await client.quit()
    }
}

main().catch(console.error)
