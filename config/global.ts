import { differenceInDays, startOfYear } from "date-fns"

export const OHLC_DATE = 'datetime'
export const OHLC_OPEN = 'open'
export const OHLC_HIGH = 'high'
export const OHLC_LOW = 'low'
export const OHLC_CLOSE = 'close'

export const CMOTS_1D = '1D'
export const CMOTS_1W = '1W'
export const CMOTS_1M = '1M'
export const CMOTS_3M = '3M'
export const CMOTS_6M = '6M'
export const CMOTS_YTD = 'YTD'
export const CMOTS_1Y = '1Y'
export const CMOTS_3Y = '3Y'
export const CMOTS_5Y = '5Y'
export const CMOTS_10Y = '10Y'

export const CMOTS_DURATIONS_MAP = {
    [CMOTS_1D]: {
        candle: '1min',
        days: 1,
    },
    [CMOTS_1W]: {
        candle: '1min',
        days: 7,
    },
    [CMOTS_1M]: {
        candle: '1d',
        days: 30,
    },
    [CMOTS_3M]: {
        candle: '1d',
        days: 90,
    },
    [CMOTS_6M]: {
        candle: '1d',
        days: 180,
    },
    [CMOTS_YTD]: {
        candle: '1d',
        days: differenceInDays(new Date(), startOfYear(new Date())),
    },
    [CMOTS_1Y]: {
        candle: '1d',
        days: 365,
    },
    [CMOTS_3Y]: {
        candle: '1d',
        days: 365 * 3,
    },
    [CMOTS_5Y]: {
        candle: '1d',
        days: 365 * 5,
    },
    [CMOTS_10Y]: {
        candle: '1d',
        days: 365 * 10,
    },
} as const

export const HISTORICAL_PRICE_FEED_KEY = 'historicalPriceFeed'

export const IST_TIME_ZONE = 'Asia/Kolkata'
export const CMOTS_BASE_URL = 'https://finskyapis.cmots.com/api/'
export const CMOTS_BSE_HISTORICAL_PRICE_FEED = CMOTS_BASE_URL + 'PriceChart/bse/'
export const CMOTS_NSE_HISTORICAL_PRICE_FEED = CMOTS_BASE_URL + 'PriceChart/nse/'

export const MARKET_OPEN_HOUR = 3
export const MARKET_OPEN_MINUTE = 45
export const MARKET_CLOSE_HOUR = 10
export const MARKET_CLOSE_MINUTE = 0

export const CMOTS_CODE_MBCODE_KEY = 'cmotsCodeMBCode'
export const MBCODE_CMOTS_CODE_KEY = 'mbCodeCmotsCode'

export const INDEX_MBCODE_PREFIX = 'MBIDX'
export const STOCK_MBCODE_PREFIX = 'MBEQU'
export const SYMBOL_MBCODE_KEY = 'symbolMBCode'
export const MBCODE_SYMBOL_KEY = 'mbCodeSymbol'
export const NAME_MBCODE_KEY = 'nameMBCode'
export const MBCODE_NAME_KEY = 'mbCodeName'

export const CMOTS_BSE_PRICE_FEED_URL = CMOTS_BASE_URL + 'bsenseprices/bse'
export const CMOTS_NSE_PRICE_FEED_URL = CMOTS_BASE_URL + 'bsenseprices/nse'

export const CMOTS_INDEX_CONSTITUENTS = CMOTS_BASE_URL + 'IndexWise-CompanyMaster/'
export const NIFTY_50_INDEX_CODE = 'MBIDX70'

export const SPECIAL_TRADING_DAYS = ['2026-02-01']

export const EXCHANGE_HOLIDAYS = [
    "2024-01-22",
    "2024-01-26",
    "2024-03-08",
    "2024-03-25",
    "2024-03-29",
    "2024-04-11",
    "2024-04-17",
    "2024-05-01",
    "2024-05-20",
    "2024-06-17",
    "2024-07-17",
    "2024-08-15",
    "2024-10-02",
    "2024-11-1",
    "2024-11-15",
    "2024-12-25",
    "2025-01-26",
    "2025-02-26",
    "2025-03-14",
    "2025-03-31",
    "2025-04-06",
    "2025-04-10",
    "2025-04-14",
    "2025-04-18",
    "2025-05-01",
    "2025-06-07",
    "2025-07-06",
    "2025-08-15",
    "2025-08-27",
    "2025-10-02",
    "2025-10-21",
    "2025-10-22",
    "2025-11-05",
    "2025-12-25",
    "2026-01-15",
    "2026-01-26",
    "2026-03-03",
    "2026-03-26",
    "2026-03-31",
    "2026-04-03",
    "2026-04-14",
    "2026-05-01",
    "2026-05-28",
    "2026-06-26",
    "2026-09-14",
    "2026-10-02",
    "2026-10-20",
    "2026-11-10",
    "2026-11-24",
    "2026-12-25",
]