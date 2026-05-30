export type MBCode = string
export type CmotsCode = number

export type GraphDuration = '1D' | '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | '3Y' | '5Y' | '10Y'

export type OHLC = {
    datetime: Date
    open: number
    high: number
    low: number
    close: number
}

export type StockQuote = {
    datetime: Date
    mbCode: string
    symbol: string
    name: string
    price: number
    open?: number
    high?: number
    low?: number
    changesPercentage: number
    change: number
    volume: number
}

export type CmotsStockQuote = {
    sc_code: string
    co_code: number
    CO_NAME: string
    price: number
    Open: number
    High: number
    Low: number
    Volume: number
    Price_diff: number
    change: number
    Tr_Date: string
}

export type CmotsIndexStockOhlc = {
    co_code: number
    lname: string
    open: number
    high: number
    low: number
    close: number
    Volume: number
    TradeDate: string
}

export interface OHLCDataPoint {
    datetime: string
    close: number
    volume: number
}

// ── Arena Types ──────────────────────────────────────────────────────────

export type OrderAction = 'BUY' | 'SELL'

export interface Order {
    symbol: string
    mbCode: string
    action: OrderAction
    quantity: number
    confidence?: number
}

export interface Trade {
    symbol: string
    mbCode: string
    action: OrderAction
    quantity: number
    orderPrice: number       // day T close (decision price)
    fillPrice: number        // day T+1 open, after slippage
    slippage: number         // absolute slippage amount
    brokerage: number        // absolute brokerage cost
    totalCost: number        // fillPrice * quantity + brokerage (for BUY) or - brokerage (for SELL)
    timestamp: string        // ISO date of execution (T+1)
}

export interface Position {
    symbol: string
    mbCode: string
    quantity: number
    avgCost: number          // volume-weighted average buy price
    currentPrice: number
    marketValue: number      // currentPrice * quantity
    unrealizedPnL: number    // marketValue - (avgCost * quantity)
    weightPct: number        // marketValue / NAV * 100
    entryDate: string
    mae: number              // max adverse excursion (worst unrealized loss)
    mfe: number              // max favorable excursion (best unrealized gain)
}

export interface PortfolioState {
    modelId: string
    cash: number
    nav: number
    totalReturn: number      // (nav - startingCapital) / startingCapital * 100
    positions: Position[]
    hhi: number              // Herfindahl-Hirschman Index for concentration
    maxDrawdown: number      // worst peak-to-trough decline in %
    currentDrawdown: number
    peakNAV: number
    turnoverCost: number     // cumulative brokerage + slippage paid
    turnoverCostPct: number  // turnoverCost / startingCapital * 100
    score: number            // totalReturn - 0.5*maxDrawdown - 0.1*turnoverCostPct
}

export interface LLMDecision {
    orders: Order[]
    risk_controls: {
        stop_loss_pct?: number
        max_portfolio_risk?: string
    }
    rationale: string
    confidence: number
}

export interface StockSignal {
    symbol: string
    mbCode: string
    close: number
    returns: { d1: number | null; d5: number | null; d20: number | null; d60: number | null }
    rsi: number | null
    macdSignal: string
    regime: string | null
    momentumRank1m: number | null
    riskFlag: boolean
    newsSummary: string
}

export interface TickSnapshot {
    runId: string
    tickDate: string         // ISO date
    marketData: Record<string, { close: number; open: number }>
    modelStates: Record<string, PortfolioState>
    modelOrders: Record<string, Order[]>
    modelTrades: Record<string, Trade[]>
    leaderboard: { modelId: string; score: number; nav: number }[]
}

export interface RunConfig {
    runId: string
    startDate: string
    endDate: string
    models: { modelId: string; provider: string }[]
    startingCapital: number
    maxPositions: number
    maxPositionPct: number
    brokerageBps: number
    slippageBps: number
}

export interface CrossSectionalRanks {
    date: string
    rankings: Record<string, {
        momentumRank1m: number
        momentumRank3m: number
        trendStrengthRank: number
        riskFlag: boolean
    }>
    breadth: {
        aboveSMA50Pct: number
        aboveSMA200Pct: number
    }
}
