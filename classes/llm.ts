import { GoogleGenAI } from '@google/genai'
import {
    CrossSectionalRanks,
    LLMDecision,
    Order,
    PortfolioState,
    StockSignal,
} from '../types/global'

// ── LLM Adapter Interface ────────────────────────────────────────────────

export interface LLMAdapter {
    modelId: string
    generateDecision(prompt: string): Promise<string>
}

// ── Gemini Flash Adapter ─────────────────────────────────────────────────

export class GeminiFlashAdapter implements LLMAdapter {
    modelId: string
    private client: GoogleGenAI

    constructor(modelId: string = 'gemini-flash', apiKey?: string) {
        this.modelId = modelId
        const key = apiKey || process.env.GEMINI_API_KEY
        if (!key) throw new Error('GEMINI_API_KEY is required')
        this.client = new GoogleGenAI({ apiKey: key })
    }

    async generateDecision(prompt: string): Promise<string> {
        const response = await this.client.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                temperature: 0.3,
            },
        })
        return response.text ?? ''
    }
}

// ── Mock LLM Adapter (for testing) ──────────────────────────────────────

export class MockLLMAdapter implements LLMAdapter {
    modelId: string

    constructor(modelId: string = 'mock-llm') {
        this.modelId = modelId
    }

    async generateDecision(_prompt: string): Promise<string> {
        // Returns a valid but empty decision (HOLD / no trades)
        const decision: LLMDecision = {
            orders: [],
            risk_controls: { max_portfolio_risk: 'conservative' },
            rationale: 'Mock LLM: holding all positions, no trades this tick.',
            confidence: 0.5,
        }
        return JSON.stringify(decision)
    }
}

// ── LLM Orchestrator ─────────────────────────────────────────────────────

export class LLMOrchestrator {
    private adapter: LLMAdapter
    private universe: string[]  // valid mbCodes in the Nifty 50

    constructor(adapter: LLMAdapter, universe: string[]) {
        this.adapter = adapter
        this.universe = universe
    }

    get modelId(): string {
        return this.adapter.modelId
    }

    /**
     * Build prompt, call LLM, parse & validate response.
     * Retries once on bad JSON, falls back to no-trade.
     */
    async getDecision(
        date: string,
        portfolioState: PortfolioState,
        stockSignals: StockSignal[],
        crossSectionalRanks: CrossSectionalRanks,
        symbolMap: Record<string, string>,  // mbCode → symbol
    ): Promise<LLMDecision> {
        const prompt = this.buildPrompt(date, portfolioState, stockSignals, crossSectionalRanks)

        // Attempt 1
        try {
            const raw = await this.adapter.generateDecision(prompt)
            const decision = this.parseAndValidate(raw, symbolMap)
            return decision
        } catch (err1) {
            console.warn(`[LLM:${this.adapter.modelId}] Attempt 1 failed: ${err1}`)

            // Attempt 2 with error feedback
            try {
                const retryPrompt = prompt + `\n\n⚠️ YOUR PREVIOUS RESPONSE FAILED PARSING. Error: ${err1}\nPlease respond with ONLY valid JSON matching the schema. No markdown, no code fences.`
                const raw2 = await this.adapter.generateDecision(retryPrompt)
                const decision = this.parseAndValidate(raw2, symbolMap)
                return decision
            } catch (err2) {
                console.error(`[LLM:${this.adapter.modelId}] Attempt 2 failed: ${err2}. Falling back to NO-TRADE.`)
                return {
                    orders: [],
                    risk_controls: {},
                    rationale: `LLM failed to produce valid output after 2 attempts. Error: ${err2}`,
                    confidence: 0,
                }
            }
        }
    }

    // ── Prompt Builder ────────────────────────────────────────────────────

    private buildPrompt(
        date: string,
        portfolio: PortfolioState,
        signals: StockSignal[],
        xsec: CrossSectionalRanks,
    ): string {
        // Summarize top movers for market context
        const top5Mom = signals
            .filter(s => s.momentumRank1m != null && s.momentumRank1m <= 5)
            .map(s => s.symbol)
        const bottom5Mom = signals
            .filter(s => s.momentumRank1m != null && s.momentumRank1m >= signals.length - 4)
            .map(s => s.symbol)

        // Build per-stock signal summaries (compact for token efficiency)
        const stockSummaries = signals.map(s => {
            const parts = [
                `${s.symbol} (${s.mbCode}): ₹${s.close}`,
                `Ret: 1d=${s.returns.d1 ?? 'N/A'}% 5d=${s.returns.d5 ?? 'N/A'}% 20d=${s.returns.d20 ?? 'N/A'}%`,
                `RSI=${s.rsi ?? 'N/A'} MACD=${s.macdSignal} Regime=${s.regime ?? 'unknown'}`,
                `MomRank=${s.momentumRank1m ?? 'N/A'}/50 Risk=${s.riskFlag ? '⚠HIGH' : 'OK'}`,
            ]
            if (s.newsSummary) parts.push(`News: ${s.newsSummary.substring(0, 150)}`)
            return parts.join(' | ')
        }).join('\n')

        // Build portfolio summary
        const positionSummary = portfolio.positions.length > 0
            ? portfolio.positions.map(p =>
                `  ${p.symbol}: ${p.quantity} shares @ ₹${p.avgCost} (now ₹${p.currentPrice}, PnL: ₹${p.unrealizedPnL}, ${p.weightPct}% of NAV)`
            ).join('\n')
            : '  (No positions held)'

        return `You are an expert stock portfolio manager competing in a Nifty 50 trading arena.
Today's date: ${date}

═══ YOUR PORTFOLIO ═══
Cash: ₹${portfolio.cash.toLocaleString('en-IN')}
NAV: ₹${portfolio.nav.toLocaleString('en-IN')}
Total Return: ${portfolio.totalReturn}%
Max Drawdown: ${portfolio.maxDrawdown}%
Score: ${portfolio.score}
Current Positions:
${positionSummary}

═══ MARKET CONTEXT ═══
Breadth: ${xsec.breadth.aboveSMA50Pct}% stocks above SMA50, ${xsec.breadth.aboveSMA200Pct}% above SMA200
Top 5 Momentum (1m): ${top5Mom.join(', ') || 'N/A'}
Bottom 5 Momentum (1m): ${bottom5Mom.join(', ') || 'N/A'}

═══ STOCK SIGNALS (all 50 Nifty stocks) ═══
${stockSummaries}

═══ TRADING RULES ═══
- Max 10 open positions at any time
- Max 20% of NAV in a single stock
- You can only BUY or SELL stocks in the Nifty 50 universe
- Orders will be filled at tomorrow's market open price
- Brokerage: 0.10% of trade value, Slippage: 0.05%
- Your goal: maximize total return while minimizing drawdown and turnover costs
- Score = totalReturn - 0.5 × maxDrawdown - 0.1 × turnoverCostPct

═══ RESPOND WITH JSON ONLY ═══
Respond with a JSON object matching this schema exactly:
{
  "orders": [
    { "symbol": "STOCKNAME", "mbCode": "MBEQUXXXX", "action": "BUY" | "SELL", "quantity": <positive integer> }
  ],
  "risk_controls": {
    "stop_loss_pct": <number, optional>,
    "max_portfolio_risk": "conservative" | "moderate" | "aggressive"
  },
  "rationale": "<brief explanation of your trading thesis>",
  "confidence": <0.0 to 1.0>
}

If you don't want to trade, return an empty orders array.
Do NOT include any text outside the JSON object. No markdown, no code fences.`
    }

    // ── Response Parser & Validator ───────────────────────────────────────

    private parseAndValidate(raw: string, symbolMap: Record<string, string>): LLMDecision {
        // Strip markdown code fences if present
        let cleaned = raw.trim()
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
        }

        const parsed = JSON.parse(cleaned)

        // Validate top-level structure
        if (!parsed || typeof parsed !== 'object') {
            throw new Error('Response is not a JSON object')
        }
        if (!Array.isArray(parsed.orders)) {
            throw new Error('Missing or invalid "orders" array')
        }
        if (typeof parsed.rationale !== 'string') {
            throw new Error('Missing or invalid "rationale" string')
        }
        if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
            throw new Error('Missing or invalid "confidence" (must be 0.0-1.0)')
        }

        // Validate each order
        const validOrders: Order[] = []
        for (const order of parsed.orders) {
            if (!order.mbCode || !this.universe.includes(order.mbCode)) {
                console.warn(`[LLM:${this.adapter.modelId}] Invalid mbCode "${order.mbCode}", skipping order`)
                continue
            }
            if (!['BUY', 'SELL'].includes(order.action)) {
                console.warn(`[LLM:${this.adapter.modelId}] Invalid action "${order.action}", skipping`)
                continue
            }
            if (!Number.isInteger(order.quantity) || order.quantity <= 0) {
                console.warn(`[LLM:${this.adapter.modelId}] Invalid quantity "${order.quantity}", skipping`)
                continue
            }

            validOrders.push({
                symbol: order.symbol || symbolMap[order.mbCode] || order.mbCode,
                mbCode: order.mbCode,
                action: order.action,
                quantity: order.quantity,
                confidence: parsed.confidence,
            })
        }

        return {
            orders: validOrders,
            risk_controls: parsed.risk_controls || {},
            rationale: parsed.rationale,
            confidence: parsed.confidence,
        }
    }
}
