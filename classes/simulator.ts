import { Order, Trade } from '../types/global'
import { ARENA_RULES, Portfolio } from './portfolio'

/**
 * Simulator Engine — converts Orders into Trades by applying
 * fill-at-next-open execution with slippage and brokerage.
 */
export class Simulator {
    private slippageBps: number
    private brokerageBps: number

    constructor(
        slippageBps: number = ARENA_RULES.SLIPPAGE_BPS,
        brokerageBps: number = ARENA_RULES.BROKERAGE_BPS,
    ) {
        this.slippageBps = slippageBps
        this.brokerageBps = brokerageBps
    }

    /**
     * Execute validated orders against next day's open prices.
     * 
     * @param orders - Validated orders from LLM (already passed risk checks)
     * @param nextDayOpenPrices - Map of mbCode → opening price on T+1
     * @param portfolio - The model's portfolio (will be mutated via applyTrade)
     * @param executionDate - ISO date string of T+1 (the fill date)
     * @returns Array of completed Trade records
     */
    executeOrders(
        orders: Order[],
        nextDayOpenPrices: Record<string, number>,
        portfolio: Portfolio,
        executionDate: string,
    ): Trade[] {
        const trades: Trade[] = []

        for (const order of orders) {
            const openPrice = nextDayOpenPrices[order.mbCode]
            if (openPrice == null || isNaN(openPrice)) {
                console.warn(`[Simulator] No open price for ${order.symbol} (${order.mbCode}), skipping order`)
                continue
            }

            // Apply slippage: buy slightly higher, sell slightly lower
            const slippageMultiplier = order.action === 'BUY'
                ? 1 + (this.slippageBps / 10000)
                : 1 - (this.slippageBps / 10000)
            const fillPrice = Math.round(openPrice * slippageMultiplier * 100) / 100

            // Calculate costs
            const tradeValue = fillPrice * order.quantity
            const slippageAmount = Math.round(Math.abs(fillPrice - openPrice) * order.quantity * 100) / 100
            const brokerageAmount = Math.round(tradeValue * (this.brokerageBps / 10000) * 100) / 100

            // For BUY: totalCost = what leaves the wallet (value + brokerage)
            // For SELL: totalCost = what enters the wallet (value - brokerage)
            let totalCost: number
            if (order.action === 'BUY') {
                totalCost = Math.round((tradeValue + brokerageAmount) * 100) / 100

                // Final cash check at actual fill price
                if (totalCost > portfolio.getCash()) {
                    console.warn(`[Simulator] Insufficient cash for BUY ${order.symbol}: need ₹${totalCost.toFixed(2)}, have ₹${portfolio.getCash().toFixed(2)}`)
                    continue
                }
            } else {
                totalCost = Math.round((tradeValue - brokerageAmount) * 100) / 100

                // Verify position exists and has enough shares
                const pos = portfolio.getPosition(order.mbCode)
                if (!pos || pos.quantity < order.quantity) {
                    console.warn(`[Simulator] Cannot SELL ${order.quantity} of ${order.symbol}: holding ${pos?.quantity ?? 0}`)
                    continue
                }
            }

            const trade: Trade = {
                symbol: order.symbol,
                mbCode: order.mbCode,
                action: order.action,
                quantity: order.quantity,
                orderPrice: openPrice,  // raw open price (pre-slippage)
                fillPrice,
                slippage: slippageAmount,
                brokerage: brokerageAmount,
                totalCost,
                timestamp: executionDate,
            }

            // Apply the trade to the portfolio
            portfolio.applyTrade(trade)
            trades.push(trade)

            console.log(
                `[Simulator] ${order.action} ${order.quantity}x ${order.symbol} @ ₹${fillPrice.toFixed(2)} ` +
                `(open: ₹${openPrice.toFixed(2)}, slip: ₹${slippageAmount.toFixed(2)}, brk: ₹${brokerageAmount.toFixed(2)})`
            )
        }

        return trades
    }
}
