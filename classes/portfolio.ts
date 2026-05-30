import { Order, Position, PortfolioState, Trade } from '../types/global'

export const ARENA_RULES = {
    STARTING_CAPITAL: 10_00_000,  // ₹10,00,000
    MAX_POSITIONS: 10,
    MAX_POSITION_PCT: 20,         // 20% of NAV
    BROKERAGE_BPS: 10,            // 10 basis points
    SLIPPAGE_BPS: 5,              // 5 basis points
} as const

interface PositionInternal {
    symbol: string
    mbCode: string
    quantity: number
    avgCost: number
    currentPrice: number
    entryDate: string
    mae: number   // max adverse excursion (worst unrealized PnL)
    mfe: number   // max favorable excursion (best unrealized PnL)
}

export class Portfolio {
    readonly modelId: string
    readonly runId: string
    readonly startingCapital: number

    private cash: number
    private positions: Map<string, PositionInternal> = new Map()
    private peakNAV: number
    private maxDrawdown: number = 0
    private cumulativeTurnoverCost: number = 0

    constructor(modelId: string, runId: string, startingCapital: number = ARENA_RULES.STARTING_CAPITAL) {
        this.modelId = modelId
        this.runId = runId
        this.startingCapital = startingCapital
        this.cash = startingCapital
        this.peakNAV = startingCapital
    }

    // ── Mark-to-Market ────────────────────────────────────────────────────

    /**
     * Update all position prices using today's closing prices.
     * Recalculates NAV, drawdown, and MAE/MFE per position.
     */
    markToMarket(closePrices: Record<string, number>): void {
        for (const [mbCode, pos] of this.positions) {
            const price = closePrices[mbCode]
            if (price == null) continue
            pos.currentPrice = price

            // Update MAE/MFE
            const unrealizedPnL = (price - pos.avgCost) * pos.quantity
            if (unrealizedPnL < pos.mae) pos.mae = unrealizedPnL
            if (unrealizedPnL > pos.mfe) pos.mfe = unrealizedPnL
        }

        // Update peak NAV and drawdown
        const nav = this.getNAV()
        if (nav > this.peakNAV) this.peakNAV = nav
        const currentDrawdown = ((this.peakNAV - nav) / this.peakNAV) * 100
        if (currentDrawdown > this.maxDrawdown) this.maxDrawdown = currentDrawdown
    }

    // ── Order Validation ──────────────────────────────────────────────────

    /**
     * Filters orders against risk rules. Returns only valid orders.
     */
    validateOrders(orders: Order[]): Order[] {
        const nav = this.getNAV()
        const validOrders: Order[] = []
        let projectedCash = this.cash
        let projectedPositionCount = this.positions.size

        for (const order of orders) {
            if (order.action === 'BUY') {
                // Check max positions limit
                const alreadyHeld = this.positions.has(order.mbCode)
                if (!alreadyHeld && projectedPositionCount >= ARENA_RULES.MAX_POSITIONS) {
                    console.warn(`[${this.modelId}] Rejected BUY ${order.symbol}: would exceed ${ARENA_RULES.MAX_POSITIONS} position limit`)
                    continue
                }

                // Estimate cost (using current price as proxy since we don't have T+1 open yet)
                const pos = this.positions.get(order.mbCode)
                const currentPrice = pos?.currentPrice ?? 0
                const estimatedCost = currentPrice * order.quantity
                const maxAllowed = nav * (ARENA_RULES.MAX_POSITION_PCT / 100)

                // Check position size limit (existing + new)
                const existingValue = pos ? pos.currentPrice * pos.quantity : 0
                if (existingValue + estimatedCost > maxAllowed) {
                    console.warn(`[${this.modelId}] Rejected BUY ${order.symbol}: would exceed ${ARENA_RULES.MAX_POSITION_PCT}% position limit`)
                    continue
                }

                // Check cash availability (rough estimate)
                if (estimatedCost > projectedCash) {
                    console.warn(`[${this.modelId}] Rejected BUY ${order.symbol}: insufficient cash (need ~₹${estimatedCost.toFixed(0)}, have ₹${projectedCash.toFixed(0)})`)
                    continue
                }

                projectedCash -= estimatedCost
                if (!alreadyHeld) projectedPositionCount++
            }

            if (order.action === 'SELL') {
                const pos = this.positions.get(order.mbCode)
                if (!pos) {
                    console.warn(`[${this.modelId}] Rejected SELL ${order.symbol}: no position held`)
                    continue
                }
                if (order.quantity > pos.quantity) {
                    console.warn(`[${this.modelId}] Rejected SELL ${order.symbol}: trying to sell ${order.quantity} but only holding ${pos.quantity}`)
                    continue
                }
            }

            validOrders.push(order)
        }

        return validOrders
    }

    // ── Apply a Completed Trade ───────────────────────────────────────────

    applyTrade(trade: Trade): void {
        if (trade.action === 'BUY') {
            const existing = this.positions.get(trade.mbCode)
            if (existing) {
                // Update average cost (volume-weighted)
                const totalQty = existing.quantity + trade.quantity
                existing.avgCost = ((existing.avgCost * existing.quantity) + (trade.fillPrice * trade.quantity)) / totalQty
                existing.quantity = totalQty
                existing.currentPrice = trade.fillPrice
            } else {
                this.positions.set(trade.mbCode, {
                    symbol: trade.symbol,
                    mbCode: trade.mbCode,
                    quantity: trade.quantity,
                    avgCost: trade.fillPrice,
                    currentPrice: trade.fillPrice,
                    entryDate: trade.timestamp,
                    mae: 0,
                    mfe: 0,
                })
            }
            this.cash -= trade.totalCost
        }

        if (trade.action === 'SELL') {
            const existing = this.positions.get(trade.mbCode)
            if (!existing) throw new Error(`Cannot sell ${trade.symbol}: no position held`)

            existing.quantity -= trade.quantity
            if (existing.quantity <= 0) {
                this.positions.delete(trade.mbCode)
            }
            // For sells: totalCost is proceeds minus brokerage (positive value)
            this.cash += trade.totalCost
        }

        this.cumulativeTurnoverCost += trade.brokerage + trade.slippage
    }

    // ── Metrics ───────────────────────────────────────────────────────────

    getNAV(): number {
        let positionValue = 0
        for (const pos of this.positions.values()) {
            positionValue += pos.currentPrice * pos.quantity
        }
        return this.cash + positionValue
    }

    getHHI(): number {
        const nav = this.getNAV()
        if (nav === 0) return 0
        let sumSquares = 0
        for (const pos of this.positions.values()) {
            const weight = (pos.currentPrice * pos.quantity) / nav
            sumSquares += weight * weight
        }
        // Include cash as a "position"
        const cashWeight = this.cash / nav
        sumSquares += cashWeight * cashWeight
        return Math.round(sumSquares * 10000) / 10000
    }

    getTotalReturn(): number {
        return Math.round(((this.getNAV() - this.startingCapital) / this.startingCapital) * 10000) / 100
    }

    getScore(): number {
        const totalReturn = this.getTotalReturn()
        const turnoverPct = (this.cumulativeTurnoverCost / this.startingCapital) * 100
        return Math.round((totalReturn - 0.5 * this.maxDrawdown - 0.1 * turnoverPct) * 100) / 100
    }

    getState(): PortfolioState {
        const nav = this.getNAV()
        const positions: Position[] = Array.from(this.positions.values()).map(pos => ({
            symbol: pos.symbol,
            mbCode: pos.mbCode,
            quantity: pos.quantity,
            avgCost: Math.round(pos.avgCost * 100) / 100,
            currentPrice: pos.currentPrice,
            marketValue: Math.round(pos.currentPrice * pos.quantity * 100) / 100,
            unrealizedPnL: Math.round((pos.currentPrice - pos.avgCost) * pos.quantity * 100) / 100,
            weightPct: nav > 0 ? Math.round((pos.currentPrice * pos.quantity / nav) * 10000) / 100 : 0,
            entryDate: pos.entryDate,
            mae: Math.round(pos.mae * 100) / 100,
            mfe: Math.round(pos.mfe * 100) / 100,
        }))

        const turnoverPct = Math.round((this.cumulativeTurnoverCost / this.startingCapital) * 10000) / 100
        const currentDrawdown = this.peakNAV > 0 ? Math.round(((this.peakNAV - nav) / this.peakNAV) * 10000) / 100 : 0

        return {
            modelId: this.modelId,
            cash: Math.round(this.cash * 100) / 100,
            nav: Math.round(nav * 100) / 100,
            totalReturn: this.getTotalReturn(),
            positions,
            hhi: this.getHHI(),
            maxDrawdown: Math.round(this.maxDrawdown * 100) / 100,
            currentDrawdown,
            peakNAV: Math.round(this.peakNAV * 100) / 100,
            turnoverCost: Math.round(this.cumulativeTurnoverCost * 100) / 100,
            turnoverCostPct: turnoverPct,
            score: this.getScore(),
        }
    }

    getCash(): number {
        return this.cash
    }

    getPositionCount(): number {
        return this.positions.size
    }

    getPosition(mbCode: string): PositionInternal | undefined {
        return this.positions.get(mbCode)
    }

    hasPosition(mbCode: string): boolean {
        return this.positions.has(mbCode)
    }
}
