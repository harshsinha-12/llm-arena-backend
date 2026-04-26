import { addDays, isWeekend } from "date-fns"
import { formatInTimeZone } from 'date-fns-tz'
import {
    EXCHANGE_HOLIDAYS,
    IST_TIME_ZONE,
    MARKET_CLOSE_HOUR,
    MARKET_CLOSE_MINUTE,
    MARKET_OPEN_HOUR,
    MARKET_OPEN_MINUTE,
    SPECIAL_TRADING_DAYS,
} from "../config/global"

export function getMarketTimings(type: 'open' | 'close', datetime?: Date) {
    datetime = datetime || new Date()
    const fakeISTDate = new Date(
        Date.UTC(
            datetime.getUTCFullYear(),
            datetime.getUTCMonth(),
            datetime.getUTCDate(),
            datetime.getUTCHours() + 5,
            datetime.getUTCMinutes() + 30
        )
    )
    const date = datetime.toISOString().split('T')[0]
    return new Date(
        Date.UTC(
            fakeISTDate.getUTCFullYear(),
            fakeISTDate.getUTCMonth(),
            fakeISTDate.getUTCDate(),
            type === 'open' ? MARKET_OPEN_HOUR : MARKET_CLOSE_HOUR,
            type === 'open' ? MARKET_OPEN_MINUTE : MARKET_CLOSE_MINUTE
        )
    )
}

export function getMarketCachedTimings(type: 'open' | 'close', datetime?: Date) {
    datetime = datetime || new Date()
    const fakeISTDate = new Date(
        Date.UTC(
            datetime.getUTCFullYear(),
            datetime.getUTCMonth(),
            datetime.getUTCDate(),
            datetime.getUTCHours() + 5,
            datetime.getUTCMinutes() + 30
        )
    )
    return new Date(
        Date.UTC(
            fakeISTDate.getUTCFullYear(),
            fakeISTDate.getUTCMonth(),
            fakeISTDate.getUTCDate(),
            type === 'open' ? MARKET_OPEN_HOUR : MARKET_CLOSE_HOUR + 1,
            type === 'open' ? MARKET_OPEN_MINUTE : MARKET_CLOSE_MINUTE
        )
    )
}

export const getMktHrLinkedCachingTime = (): number => {
    if (isTradingDay() && isCachedTradingHours()) {
        const now = new Date()
        let target = new Date()
        const nextFifthMin = Math.ceil((now.getUTCMinutes() + 1) / 5) * 5
        target.setUTCHours(now.getUTCHours(), nextFifthMin, 0, 0)
        return target.getTime() - now.getTime()
    }
    return getNextMarketOpen().getTime() - Date.now()
}

export function isTradingDay(datetime?: Date) {
    datetime = datetime || new Date()
    const date = datetime.toISOString().split('T')[0]
    return isSpecialTradingDay(datetime) || (!isExchangeHoliday(datetime) && !isWeekend(datetime))
}

export function isSpecialTradingDay(datetime?: Date) {
    datetime = datetime || new Date()
    const indianDate = formatInTimeZone(datetime, IST_TIME_ZONE, 'yyyy-MM-dd')
    return SPECIAL_TRADING_DAYS.includes(indianDate)
}

export function isExchangeHoliday(datetime?: Date) {
    datetime = datetime || new Date()
    const indianDate = formatInTimeZone(datetime, IST_TIME_ZONE, 'yyyy-MM-dd')
    return EXCHANGE_HOLIDAYS.includes(indianDate)
}

export function isCachedTradingHours(datetime?: Date) {
    datetime = datetime || new Date()
    return !isPreTradingHours(datetime) && !(datetime > getMarketCachedTimings('close', datetime))
}

export function isPreTradingHours(datetime?: Date) {
    datetime = datetime || new Date()
    return datetime < getMarketTimings('open', datetime)
}

export function getNextMarketOpen(datetime?: Date) {
    datetime = datetime || new Date()
    if (isTradingDay(datetime) && isPreTradingHours(datetime)) {
        return getMarketTimings('open', datetime)
    } else {
        return getMarketTimings('open', getNextTradingDay(datetime))
    }
}

export function getNextTradingDay(datetime?: Date) {
    datetime = datetime || new Date()
    const nextDay = addDays(datetime, 1)
    if (isTradingDay(nextDay)) return nextDay
    return getNextTradingDay(nextDay)
}
