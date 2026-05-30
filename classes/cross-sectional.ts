import { CrossSectionalRanks, OHLC } from '../types/global'
import { Technicals } from './technicals'

interface StockFeatures {
    mbCode: string
    returns: { d1: number | null; d5: number | null; d20: number | null; d60: number | null }
    maAlignmentScore: number | null
    atrValue: number | null
    sma50: number | null
    sma200: number | null
    latestClose: number | null
}

/**
 * Cross-Sectional Ranker — ranks all 50 Nifty stocks against each other
 * on the same date to provide market-wide context to LLMs.
 */
export class CrossSectionalRanker {

    /**
     * Compute cross-sectional ranks for all stocks on a given date.
     * 
     * @param stocksOhlc - Map of mbCode → OHLC[] (sorted chronologically, up to the date)
     * @param date - ISO date string
     */
    compute(stocksOhlc: Record<string, OHLC[]>, date: string): CrossSectionalRanks {
        // Step 1: Compute per-stock features
        const features: StockFeatures[] = []

        for (const [mbCode, ohlc] of Object.entries(stocksOhlc)) {
            if (!ohlc || ohlc.length < 5) continue

            const tech = new Technicals(ohlc)
            const returns = tech.getReturns()
            const maAlignment = tech.getMAAlignmentScore()
            const atr = tech.getATR()
            const smaResults = tech.getSMA()

            const sma50 = smaResults.find(r => r.name === 'sma50')?.value as number | null ?? null
            const sma200 = smaResults.find(r => r.name === 'sma200')?.value as number | null ?? null

            const sorted = [...ohlc].sort((a, b) =>
                new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
            )
            const latestClose = sorted[sorted.length - 1]?.close ?? null

            features.push({
                mbCode,
                returns,
                maAlignmentScore: maAlignment,
                atrValue: atr.value as number | null,
                sma50,
                sma200,
                latestClose,
            })
        }

        // Step 2: Rank by momentum (1m = d20 return, 3m = d60 return)
        const byMom1m = [...features]
            .filter(f => f.returns.d20 != null)
            .sort((a, b) => (b.returns.d20 ?? 0) - (a.returns.d20 ?? 0))

        const byMom3m = [...features]
            .filter(f => f.returns.d60 != null)
            .sort((a, b) => (b.returns.d60 ?? 0) - (a.returns.d60 ?? 0))

        // Step 3: Rank by trend strength (MA alignment score)
        const byTrend = [...features]
            .filter(f => f.maAlignmentScore != null)
            .sort((a, b) => (b.maAlignmentScore ?? 0) - (a.maAlignmentScore ?? 0))

        // Step 4: Compute ATR percentile for risk flag (top 20% = high risk)
        const atrValues = features
            .filter(f => f.atrValue != null)
            .map(f => f.atrValue!)
            .sort((a, b) => a - b)
        const atr80thPercentile = atrValues.length > 0
            ? atrValues[Math.floor(atrValues.length * 0.8)]
            : Infinity

        // Step 5: Compute market breadth
        let aboveSMA50 = 0
        let aboveSMA200 = 0
        let totalWithSMA50 = 0
        let totalWithSMA200 = 0

        for (const f of features) {
            if (f.latestClose != null && f.sma50 != null) {
                totalWithSMA50++
                if (f.latestClose > f.sma50) aboveSMA50++
            }
            if (f.latestClose != null && f.sma200 != null) {
                totalWithSMA200++
                if (f.latestClose > f.sma200) aboveSMA200++
            }
        }

        // Step 6: Build rankings map
        const rankings: CrossSectionalRanks['rankings'] = {}

        for (const f of features) {
            const mom1mRank = byMom1m.findIndex(x => x.mbCode === f.mbCode) + 1
            const mom3mRank = byMom3m.findIndex(x => x.mbCode === f.mbCode) + 1
            const trendRank = byTrend.findIndex(x => x.mbCode === f.mbCode) + 1
            const riskFlag = f.atrValue != null ? f.atrValue >= atr80thPercentile : false

            rankings[f.mbCode] = {
                momentumRank1m: mom1mRank || features.length,
                momentumRank3m: mom3mRank || features.length,
                trendStrengthRank: trendRank || features.length,
                riskFlag,
            }
        }

        return {
            date,
            rankings,
            breadth: {
                aboveSMA50Pct: totalWithSMA50 > 0 ? Math.round((aboveSMA50 / totalWithSMA50) * 100) : 0,
                aboveSMA200Pct: totalWithSMA200 > 0 ? Math.round((aboveSMA200 / totalWithSMA200) * 100) : 0,
            },
        }
    }
}
