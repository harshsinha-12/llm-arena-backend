import { williamsr } from 'technicalindicators'
import {
    ADX,
    ATR,
    BollingerBands,
    BollingerBandsWidth,
    CCI,
    DEMA,
    EMA,
    MACD,
    MOM,
    ROC,
    RSI,
    SMA,
    StochasticOscillator,
    StochasticRSI,
    WMA,
} from 'trading-signals'
import { OHLC } from '../types/global'

type IndicatorResult = {
    name?: string
    value: number | null
    action: 'Bullish' | 'Bearish' | 'Neutral'
}

type BollingerBand = {
    value: {
        upper: number | null
        middle: number | null
        lower: number | null
    }
    action: 'Bullish' | 'Bearish' | 'Neutral'
}

type MACDResult = {
    value: {
        macd: number | null
        signal: number | null
        difference: number | null
    }
    action: 'Bullish' | 'Bearish' | 'Neutral'
}

type CrossoverResult = {
    value:
    | number
    | null
    | {
        difference: number | null
        lastCrossoverDate: string | null | undefined
        daysSinceLastCrossover: number | null | undefined
        trendState: string | null | undefined
        ema50: number | null | undefined
        ema200: number | null | undefined
        lastCrossoverType: 'Golden Crossover' | 'Death Crossover' | null | undefined
    }
    action: 'Bullish' | 'Bearish' | 'Neutral'
}

type ReturnsResult = {
    d1: number | null
    d5: number | null
    d20: number | null
    d60: number | null
}

type VolatilityResult = {
    vol20d: number | null
    vol60d: number | null
}

type TrendSlopeResult = {
    slope20: number | null
    slope60: number | null
}

type GapMetricsResult = {
    frequency: number | null
    avgGapSize: number | null
}

type TailRiskResult = {
    worst5d: number | null
    kurtosis: number | null
}

type RegimeClass = 'trending_bull' | 'trending_bear' | 'ranging' | 'reversal'

type MeanReversionResult = {
    score: number | null
    action: 'Bullish' | 'Bearish' | 'Neutral'
}

export class Technicals {
    private ohlcData: OHLC[]
    constructor(ohlcData: OHLC[]) {
        this.ohlcData = ohlcData.sort(
            (a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
        )
    }
    private periods = [5, 10, 20, 30, 50, 100, 150, 200]

    // Moving Averages
    getSMA() {
        return this.periods.flatMap((p): IndicatorResult => {
            const sma = new SMA(p)
            const slicedData = this.ohlcData.slice(0, p)
            if (slicedData.length < p) {
                return { name: `sma${p}`, value: null, action: 'Neutral' }
            }
            slicedData.sort(
                (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
            )
            try {
                slicedData.forEach((price) => {
                    sma.update(price.close!, false)
                })
                const res = Math.round(Number(sma.getResult()) * 100) / 100
                const action =
                    res < slicedData[slicedData.length - 1].close!
                        ? 'Bullish'
                        : res > slicedData[slicedData.length - 1].close!
                            ? 'Bearish'
                            : 'Neutral'
                return { name: `sma${p}`, value: res, action: action }
            } catch {
                return { name: `sma${p}`, value: null, action: 'Neutral' }
            }
        })
    }

    getEMA() {
        return this.periods.flatMap((p): IndicatorResult => {
            const ema = new EMA(p)
            const slicedData = this.ohlcData.slice(0, p)
            if (slicedData.length < p) {
                return { name: `ema${p}`, value: null, action: 'Neutral' }
            }
            slicedData.sort(
                (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
            )
            try {
                slicedData.forEach((price) => {
                    ema.update(price.close!, false)
                })
                const res = Math.round(Number(ema.getResult()) * 100) / 100
                const action =
                    res < slicedData[slicedData.length - 1].close!
                        ? 'Bullish'
                        : res > slicedData[slicedData.length - 1].close!
                            ? 'Bearish'
                            : 'Neutral'
                return { name: `ema${p}`, value: res, action: action }
            } catch {
                return { name: `ema${p}`, value: null, action: 'Neutral' }
            }
        })
    }

    getDEMA() {
        return this.periods.flatMap((p): IndicatorResult => {
            const dema = new DEMA(p)
            const slicedData = this.ohlcData.slice(0, p)
            if (slicedData.length < p) {
                return { name: `dema${p}`, value: null, action: 'Neutral' }
            }
            slicedData.sort(
                (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
            )
            try {
                slicedData.forEach((price) => {
                    dema.update(price.close!, false)
                })
                if (!dema.isStable) {
                    return { name: `dema${p}`, value: null, action: 'Neutral' }
                }
                const res = Math.round(Number(dema.getResult()) * 100) / 100
                const action =
                    res < slicedData[slicedData.length - 1].close!
                        ? 'Bullish'
                        : res > slicedData[slicedData.length - 1].close!
                            ? 'Bearish'
                            : 'Neutral'
                return { name: `dema${p}`, value: res, action: action }
            } catch {
                return { name: `dema${p}`, value: null, action: 'Neutral' }
            }
        })
    }

    getWMA() {
        return this.periods.flatMap((p): IndicatorResult => {
            const wma = new WMA(p)
            const slicedData = this.ohlcData.slice(0, p)
            if (slicedData.length < p) {
                return { name: `wma${p}`, value: null, action: 'Neutral' }
            }
            slicedData.sort(
                (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
            )
            try {
                slicedData.forEach((price) => {
                    wma.update(price.close!, false)
                })
                if (!wma.isStable) {
                    return { name: `wma${p}`, value: null, action: 'Neutral' }
                }
                const res = Math.round(Number(wma.getResult()) * 100) / 100
                const action =
                    res < slicedData[slicedData.length - 1].close!
                        ? 'Bullish'
                        : res > slicedData[slicedData.length - 1].close!
                            ? 'Bearish'
                            : 'Neutral'
                return { name: `wma${p}`, value: res, action: action }
            } catch {
                return { name: `wma${p}`, value: null, action: 'Neutral' }
            }
        })
    }

    //Oscillators
    getGoldenDeathCross(): CrossoverResult {
        const sortedData = [...this.ohlcData].sort(
            (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
        )
        try {
            const ema50 = new EMA(50)
            const ema200 = new EMA(200)
            let lastCrossoverDate: Date | undefined
            let lastCrossoverType: 'Golden Crossover' | 'Death Crossover' | undefined
            let previousEma50OverEma200: boolean | undefined = undefined
            for (let i = 0; i < sortedData.length; i++) {
                const price = sortedData[i]
                ema50.update(price.close!, false)
                ema200.update(price.close!, false)
                if (ema50.isStable && ema200.isStable) {
                    const ema50Value = Number(ema50.getResult())
                    const ema200Value = Number(ema200.getResult())
                    const ema50OverEma200 = ema50Value > ema200Value
                    if (
                        previousEma50OverEma200 !== undefined &&
                        previousEma50OverEma200 !== ema50OverEma200
                    ) {
                        lastCrossoverDate = new Date(price.datetime)
                        lastCrossoverType = ema50OverEma200 ? 'Golden Crossover' : 'Death Crossover'
                    }
                    previousEma50OverEma200 = ema50OverEma200
                }
            }
            if (!ema50.isStable || !ema200.isStable) {
                return { value: null, action: 'Neutral' }
            }
            const ema50Value = Number(ema50.getResult())
            const ema200Value = Number(ema200.getResult())
            let action: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral'
            let trendState = ''
            if (lastCrossoverType === 'Golden Crossover') {
                action = 'Bullish'
                trendState = 'Golden Crossover'
            } else if (lastCrossoverType === 'Death Crossover') {
                action = 'Bearish'
                trendState = 'Death Crossover'
            } else if (ema50Value > ema200Value) {
                trendState = 'Above Golden Crossover'
                action = 'Bullish'
            } else {
                trendState = 'Below Death Crossover'
                action = 'Bearish'
            }
            let daysSinceLastCrossover: number | undefined
            if (lastCrossoverDate) {
                const lastDateInData = new Date(sortedData[sortedData.length - 1].datetime)
                const timeDiff = lastDateInData.getTime() - lastCrossoverDate.getTime()
                daysSinceLastCrossover = Math.floor(timeDiff / (1000 * 3600 * 24))
            }
            return {
                value: {
                    difference: Math.round((ema50Value - ema200Value) * 100) / 100,
                    lastCrossoverDate: lastCrossoverDate?.toISOString(),
                    daysSinceLastCrossover,
                    trendState,
                    ema50: Math.round(ema50Value * 100) / 100,
                    ema200: Math.round(ema200Value * 100) / 100,
                    lastCrossoverType,
                },
                action,
            }
        } catch {
            return {
                value: {
                    difference: null,
                    lastCrossoverDate: null,
                    daysSinceLastCrossover: null,
                    trendState: null,
                    ema50: null,
                    ema200: null,
                    lastCrossoverType: null,
                },
                action: 'Neutral',
            }
        }
    }

    getRSI(): IndicatorResult {
        const rsi = new RSI(14, WMA)
        const slicedData = this.ohlcData.slice(0, 15)
        slicedData.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
        try {
            slicedData.forEach((price) => {
                rsi.update(price.close!, false)
            })
            const res = Math.round(Number(rsi.getResult()) * 100) / 100
            const action = res < 30 ? 'Bullish' : res > 70 ? 'Bearish' : 'Neutral'
            return {
                value: res,
                action: action,
            }
        } catch {
            return { value: null, action: 'Neutral' }
        }
    }

    getROC(): IndicatorResult {
        const roc = new ROC(14)
        const slicedData = this.ohlcData.slice(0, 15)
        slicedData.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
        try {
            slicedData.forEach((price) => {
                roc.update(price.close!, false)
            })
            const res = Math.round(Number(roc.getResult()) * 10000) / 100
            const action = res > 0 ? 'Bullish' : res < 0 ? 'Bearish' : 'Neutral'
            return {
                value: res,
                action: action,
            }
        } catch {
            return { value: null, action: 'Neutral' }
        }
    }

    getMomentum(): IndicatorResult {
        const momentum = new MOM(10)
        const slicedData = this.ohlcData.slice(0, 11)
        slicedData.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
        try {
            slicedData.forEach((price) => {
                momentum.update(price.close!, false)
            })
            const res = Math.round(Number(momentum.getResult()) * 100) / 100
            const action = res > 0 ? 'Bearish' : res < 0 ? 'Bullish' : 'Neutral'
            return {
                value: res,
                action: action,
            }
        } catch {
            return { value: null, action: 'Neutral' }
        }
    }

    getCCI(): IndicatorResult {
        const cci = new CCI(20)
        const slicedData = this.ohlcData.slice(0, 20)
        slicedData.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
        try {
            slicedData.forEach((price) => {
                cci.update(
                    {
                        close: price.close!,
                        high: price.high!,
                        low: price.low!,
                    },
                    false
                )
            })
            const res = Math.round(Number(cci.getResult()) * 100) / 100
            const action = res < -100 ? 'Bullish' : res > 100 ? 'Bearish' : 'Neutral'
            return {
                value: res,
                action: action,
            }
        } catch {
            return { value: null, action: 'Neutral' }
        }
    }

    getADX(): IndicatorResult {
        const adx = new ADX(14, SMA)
        const slicedData = this.ohlcData.slice(0, 27)
        slicedData.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
        try {
            slicedData.forEach((price) => {
                adx.update(
                    {
                        close: price.close!,
                        high: price.high!,
                        low: price.low!,
                    },
                    false
                )
            })
            const res = Math.round(Number(adx.getResult()) * 100) / 100
            const action = res > 25 ? 'Bullish' : res < 25 ? 'Bearish' : 'Neutral'
            return {
                value: res,
                action: action,
            }
        } catch {
            return { value: null, action: 'Neutral' }
        }
    }

    getBollingerBands(): BollingerBand {
        const bb = new BollingerBands(20, 2)
        const slicedData = this.ohlcData.slice(0, 21)
        slicedData.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
        try {
            slicedData.forEach((price) => {
                bb.update(price.close!, false)
            })
            const bbResult = bb.getResult()
            if (!bbResult) {
                return {
                    value: { upper: null, middle: null, lower: null },
                    action: 'Neutral',
                }
            }
            const upper = Math.round(Number(bbResult.upper) * 100) / 100
            const middle = Math.round(Number(bbResult.middle) * 100) / 100
            const lower = Math.round(Number(bbResult.lower) * 100) / 100
            const currentPrice = slicedData[slicedData.length - 1].close!
            const action =
                currentPrice < lower ? 'Bullish' : currentPrice > upper ? 'Bearish' : 'Neutral'
            return {
                value: { upper, middle, lower },
                action: action,
            }
        } catch {
            return {
                value: { upper: null, middle: null, lower: null },
                action: 'Neutral',
            }
        }
    }

    getMACD(): MACDResult {
        const macd_ = new MACD({
            longInterval: 26,
            shortInterval: 12,
            signalInterval: 9,
            indicator: EMA,
        })
        const slicedData = this.ohlcData.slice(0, 200)
        slicedData.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
        try {
            slicedData.forEach((price) => {
                macd_.update(price.close!, false)
            })
            const macdResult = macd_.getResult()
            if (!macdResult) {
                return {
                    value: { macd: null, signal: null, difference: null },
                    action: 'Neutral',
                }
            }
            const difference = Math.round(Number(macdResult.histogram) * 100) / 100
            const macd = Math.round(Number(macdResult.macd) * 100) / 100
            const signal = Math.round(Number(macdResult.signal) * 100) / 100
            const action = difference > 0 ? 'Bullish' : difference < 0 ? 'Bearish' : 'Neutral'
            return {
                value: { macd, signal, difference },
                action: action,
            }
        } catch {
            return {
                value: { macd: null, signal: null, difference: null },
                action: 'Neutral',
            }
        }
    }

    getStochasticOscillator(): IndicatorResult {
        const stochasticOscillator = new StochasticOscillator(14, 3, 3)
        const slicedData = this.ohlcData.slice(0, 27)
        slicedData.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
        try {
            slicedData.forEach((price) => {
                stochasticOscillator.update(
                    {
                        close: price.close!,
                        high: price.high!,
                        low: price.low!,
                    },
                    false
                )
            })
            const result = stochasticOscillator.getResult()
            if (!result) {
                return { value: null, action: 'Neutral' }
            }
            const res = Math.round(Number(result.stochK) * 100) / 100
            const action = res < 20 ? 'Bullish' : res > 80 ? 'Bearish' : 'Neutral'
            return {
                value: res,
                action: action,
            }
        } catch {
            return { value: null, action: 'Neutral' }
        }
    }

    getStochasticRSI(): IndicatorResult {
        const stochRSI = new StochasticRSI(14, WMA)
        const slicedData = this.ohlcData.slice(0, 50)
        slicedData.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
        try {
            slicedData.forEach((price) => {
                stochRSI.update(price.close!, false)
            })
            const res = Math.round(Number(stochRSI.getResult()) * 10000) / 100
            const action = res < 30 ? 'Bullish' : res > 70 ? 'Bearish' : 'Neutral'
            return {
                value: res,
                action: action,
            }
        } catch {
            return { value: null, action: 'Neutral' }
        }
    }

    getWilliamsR(): IndicatorResult {
        const period = 14
        const sortedData = [...this.ohlcData]
            .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
            .slice(-period - 1)
        if (sortedData.length < period + 1) {
            return { value: null, action: 'Neutral' }
        }
        const highs = sortedData.map((d) => d.high!)
        const lows = sortedData.map((d) => d.low!)
        const closes = sortedData.map((d) => d.close!)
        const res = williamsr({
            high: highs,
            low: lows,
            close: closes,
            period,
        })
        if (res.length === 0) {
            return { value: null, action: 'Neutral' }
        }
        const last = res[res.length - 1]
        const action = last < -80 ? 'Bullish' : last > -20 ? 'Bearish' : 'Neutral'
        return { value: Math.round(last * 100) / 100, action }
    }

    getATR(): IndicatorResult {
        const atr = new ATR(14)
        const slicedData = this.ohlcData
            .filter((data) => new Date(data.datetime).getFullYear())
            .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
            .slice(-15)
        if (slicedData.length < 15) return { value: null, action: 'Neutral' }
        try {
            slicedData.reverse().forEach((price) => {
                atr.update({ high: price.high!, low: price.low!, close: price.close! }, false)
            })
            const atrResult = atr.getResult()
            if (!atrResult) {
                return { value: null, action: 'Neutral' }
            }
            const atrValue = atrResult.toNumber()
            const latestClose = slicedData[0].close!
            const atrPercent = (atrValue / latestClose) * 100
            const atrRounded = Math.round(atrValue * 100) / 100
            const trend = slicedData[0].close! > slicedData[1].close! ? 'rising' : 'falling'
            let action: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral'
            if (atrPercent > 4) {
                action = trend === 'rising' ? 'Bullish' : 'Bearish'
            }
            return { value: atrRounded, action }
        } catch {
            return { value: null, action: 'Neutral' }
        }
    }

    getBBW(): IndicatorResult {
        const bollingerBands = new BollingerBands(20)
        const bbw = new BollingerBandsWidth(bollingerBands)
        const sorted = [...this.ohlcData].sort(
            (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
        )
        const sliced = sorted.slice(-21)
        if (sliced.length < 21) return { value: null, action: 'Neutral' }
        try {
            sliced.forEach((price) => {
                bbw.update(price.close!, false)
            })
            const result = bbw.getResult()?.toNumber()
            if (result === undefined) return { value: null, action: 'Neutral' }
            const roundedResult = Math.round(result * 100) / 100
            return { value: roundedResult, action: roundedResult > 20 ? 'Bullish' : 'Neutral' }
        } catch {
            return { value: null, action: 'Neutral' }
        }
    }

    getSTC(): IndicatorResult {
        const sorted = [...this.ohlcData].sort(
            (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
        )
        if (sorted.length < 60) return { value: null, action: 'Neutral' }
        try {
            const macd = new MACD({
                longInterval: 50,
                shortInterval: 23,
                signalInterval: 10,
                indicator: EMA,
            })
            const macdValues: number[] = []
            sorted.forEach((price) => {
                macd.update(price.close!, false)
                if (macd.isStable) {
                    const macdResult = macd.getResult()
                    if (macdResult && macdResult.macd !== undefined && macdResult.macd !== null) {
                        macdValues.push(macdResult.macd.toNumber())
                    }
                }
            })
            if (macdValues.length < 10) return { value: null, action: 'Neutral' }
            const ema = new EMA(10)
            macdValues.forEach((val) => {
                ema.update(val, false)
            })
            if (!ema.isStable) return { value: null, action: 'Neutral' }
            const emaResult = ema.getResult()
            if (!emaResult) return { value: null, action: 'Neutral' }
            const result = emaResult.toNumber()
            const value = Math.round(result * 100) / 100
            const action = value > 75 ? 'Bearish' : value < 25 ? 'Bullish' : 'Neutral'
            return { value, action }
        } catch {
            return { value: null, action: 'Neutral' }
        }
    }

    getMovingAverages() {
        const movingAvgs = [...this.getSMA(), ...this.getEMA(), ...this.getDEMA(), ...this.getWMA()]
        let buyCount = 0
        let sellCount = 0
        let neutralCount = 0
        const indicators = movingAvgs.reduce(
            (
                acc: {
                    [key: string]: {
                        value: number | null
                        action: 'Bullish' | 'Bearish' | 'Neutral'
                    }
                },
                curr
            ) => {
                acc[curr.name!] = { value: curr.value, action: curr.action }
                curr.action === 'Bullish'
                    ? buyCount++
                    : curr.action === 'Bearish'
                        ? sellCount++
                        : neutralCount++
                return acc
            },
            {}
        )
        return {
            indicators,
            sentiment: { bullish: buyCount, bearish: sellCount, neutral: neutralCount },
        }
    }

    getOscillators() {
        const rsi = this.getRSI()
        const roc = this.getROC()
        const momentum = this.getMomentum()
        const cci = this.getCCI()
        const adx = this.getADX()
        const bollingerBands = this.getBollingerBands()
        const macd = this.getMACD()
        const stochasticOscillator = this.getStochasticOscillator()
        const stochasticRSI = this.getStochasticRSI()
        const williamsR = this.getWilliamsR()
        const atr = this.getATR()
        const bbw = this.getBBW()
        const stc = this.getSTC()
        const crossover = this.getGoldenDeathCross()
        let buyCount = 0
        let sellCount = 0
        let neutralCount = 0
        const indicators = {
            rsi: { value: rsi.value, action: rsi.action },
            roc: { value: roc.value, action: roc.action },
            momentum: { value: momentum.value, action: momentum.action },
            cci: { value: cci.value, action: cci.action },
            adx: { value: adx.value, action: adx.action },
            bollingerBands: bollingerBands,
            macd: macd,
            stochasticOscillator: {
                value: stochasticOscillator.value,
                action: stochasticOscillator.action,
            },
            stochasticRSI: { value: stochasticRSI.value, action: stochasticRSI.action },
            williamsR: { value: williamsR.value, action: williamsR.action },
            atr: { value: atr.value, action: atr.action },
            bbw: { value: bbw.value, action: bbw.action },
            stc: { value: stc.value, action: stc.action },
            crossover: crossover,
        }
        const combinedData = [
            rsi,
            roc,
            momentum,
            cci,
            adx,
            bollingerBands,
            macd,
            stochasticOscillator,
            stochasticRSI,
            williamsR,
            atr,
            bbw,
            stc,
            crossover,
        ]
        combinedData.forEach((item) => {
            item.action === 'Bullish'
                ? buyCount++
                : item.action === 'Bearish'
                    ? sellCount++
                    : neutralCount++
        })
        return {
            indicators,
            sentiment: { bullish: buyCount, bearish: sellCount, neutral: neutralCount },
        }
    }

    getOverallSentiment() {
        const movingAveragesSentiment = this.getMovingAverages().sentiment
        const oscillatorsSentiment = this.getOscillators().sentiment
        return {
            bullish: movingAveragesSentiment.bullish + oscillatorsSentiment.bullish,
            neutral: movingAveragesSentiment.neutral + oscillatorsSentiment.neutral,
            bearish: movingAveragesSentiment.bearish + oscillatorsSentiment.bearish,
        }
    }
    // ── Derived / Composite Features ──────────────────────────────────────────
    getReturns(): ReturnsResult {
        const sorted = [...this.ohlcData].sort(
            (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
        )
        const latest = sorted[sorted.length - 1]?.close
        if (latest == null) return { d1: null, d5: null, d20: null, d60: null }
        const ret = (n: number): number | null => {
            if (sorted.length < n + 1) return null
            const prev = sorted[sorted.length - 1 - n].close
            return Math.round(((latest - prev) / prev) * 10000) / 100
        }
        return { d1: ret(1), d5: ret(5), d20: ret(20), d60: ret(60) }
    }

    getVolatility(): VolatilityResult {
        const sorted = [...this.ohlcData].sort(
            (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
        )
        const calcVol = (n: number): number | null => {
            if (sorted.length < n + 1) return null
            const slice = sorted.slice(-(n + 1))
            const logReturns: number[] = []
            for (let i = 1; i < slice.length; i++) {
                logReturns.push(Math.log(slice[i].close / slice[i - 1].close))
            }
            const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length
            const variance =
                logReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
                (logReturns.length - 1)
            return Math.round(Math.sqrt(variance) * Math.sqrt(252) * 10000) / 100
        }
        return { vol20d: calcVol(20), vol60d: calcVol(60) }
    }

    getTrendSlope(): TrendSlopeResult {
        const sorted = [...this.ohlcData].sort(
            (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
        )
        const calcSlope = (n: number): number | null => {
            if (sorted.length < n) return null
            const slice = sorted.slice(-n)
            const len = slice.length
            const sumX = (len * (len - 1)) / 2
            const sumXX = (len * (len - 1) * (2 * len - 1)) / 6
            let sumY = 0
            let sumXY = 0
            for (let i = 0; i < len; i++) {
                sumY += slice[i].close
                sumXY += i * slice[i].close
            }
            const slope = (len * sumXY - sumX * sumY) / (len * sumXX - sumX * sumX)
            const meanPrice = sumY / len
            return Math.round((slope / meanPrice) * 10000) / 100 // % per day, normalised
        }
        return { slope20: calcSlope(20), slope60: calcSlope(60) }
    }

    getGapMetrics(): GapMetricsResult {
        const sorted = [...this.ohlcData].sort(
            (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
        )
        if (sorted.length < 2) return { frequency: null, avgGapSize: null }
        const gaps: number[] = []
        for (let i = 1; i < sorted.length; i++) {
            const gap = ((sorted[i].open - sorted[i - 1].close) / sorted[i - 1].close) * 100
            gaps.push(gap)
        }
        const significant = gaps.filter((g) => Math.abs(g) > 0.5)
        const frequency = Math.round((significant.length / gaps.length) * 100) / 100
        const avgGapSize =
            Math.round((gaps.reduce((a, b) => a + Math.abs(b), 0) / gaps.length) * 100) / 100
        return { frequency, avgGapSize }
    }

    getTailRisk(): TailRiskResult {
        const sorted = [...this.ohlcData].sort(
            (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
        )
        if (sorted.length < 6) return { worst5d: null, kurtosis: null }
        const returns5d: number[] = []
        for (let i = 5; i < sorted.length; i++) {
            returns5d.push(((sorted[i].close - sorted[i - 5].close) / sorted[i - 5].close) * 100)
        }
        const worst5d = Math.round(Math.min(...returns5d) * 100) / 100
        const dailyReturns: number[] = []
        for (let i = 1; i < sorted.length; i++) {
            dailyReturns.push((sorted[i].close - sorted[i - 1].close) / sorted[i - 1].close)
        }
        const n = dailyReturns.length
        const mean = dailyReturns.reduce((a, b) => a + b, 0) / n
        const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / n
        const std = Math.sqrt(variance)
        const kurtosis =
            std === 0
                ? null
                : Math.round(
                    (dailyReturns.reduce(
                        (sum, r) => sum + Math.pow((r - mean) / std, 4),
                        0
                    ) /
                        n -
                        3) *
                    100
                ) / 100 // excess kurtosis
        return { worst5d, kurtosis }
    }
    // Fraction of consecutive EMA pairs (fast > slow) that are bullish-aligned.
    // 1.0 = perfectly stacked bull trend, 0.0 = fully inverted bear trend.
    getMAAlignmentScore(): number | null {
        const emaResults = this.getEMA()
        const emaMap = new Map<number, number>()
        for (const r of emaResults) {
            if (r.name && r.value !== null) {
                emaMap.set(parseInt(r.name.replace('ema', '')), r.value as number)
            }
        }
        const periods = [5, 10, 20, 30, 50, 100, 150, 200]
        let aligned = 0
        let total = 0
        for (let i = 0; i < periods.length - 1; i++) {
            const fast = emaMap.get(periods[i])
            const slow = emaMap.get(periods[i + 1])
            if (fast != null && slow != null) {
                total++
                if (fast > slow) aligned++
            }
        }
        return total === 0 ? null : Math.round((aligned / total) * 100) / 100
    }
    // Composite of ROC + MACD histogram + Stochastic, normalised to [-1, 1].
    getMomentumComposite(): number | null {
        const roc = this.getROC()
        const macd = this.getMACD()
        const stoch = this.getStochasticOscillator()
        const scores: number[] = []
        if (roc.value !== null) {
            scores.push(Math.max(-1, Math.min(1, (roc.value as number) / 10)))
        }
        if (macd.value.difference !== null) {
            // Normalise by dividing by 5 — works for most large/mid caps
            scores.push(Math.max(-1, Math.min(1, macd.value.difference / 5)))
        }
        if (stoch.value !== null) {
            // Stoch 0–100 → -1 to +1 (50 = 0)
            scores.push(((stoch.value as number) - 50) / 50)
        }
        if (scores.length === 0) return null
        const composite = scores.reduce((a, b) => a + b, 0) / scores.length
        return Math.round(composite * 100) / 100
    }
    // Classifies current market regime for this stock.
    getRegimeClass(): RegimeClass | null {
        const adx = this.getADX()
        const crossover = this.getGoldenDeathCross()
        const maAlignment = this.getMAAlignmentScore()
        if (adx.value === null || maAlignment === null) return null
        const isTrending = (adx.value as number) > 25
        if (!isTrending) return 'ranging'
        const crossoverVal =
            typeof crossover.value === 'object' && crossover.value !== null
                ? crossover.value
                : null
        const recentCross = crossoverVal?.lastCrossoverType ?? null
        const daysSince = crossoverVal?.daysSinceLastCrossover ?? null
        // A crossover in last 20 days is a potential regime transition
        const isRecentCross = daysSince != null && daysSince <= 20
        if (maAlignment >= 0.6) {
            return isRecentCross && recentCross === 'Death Crossover' ? 'reversal' : 'trending_bull'
        }
        if (maAlignment <= 0.4) {
            return isRecentCross && recentCross === 'Golden Crossover'
                ? 'reversal'
                : 'trending_bear'
        }
        return 'ranging'
    }
    // Fraction of bullish signals out of all decisive (non-neutral) signals.
    // 1.0 = full bullish consensus, 0.0 = full bearish consensus.
    getConfluenceScore(): number | null {
        const sentiment = this.getOverallSentiment()
        const decisive = sentiment.bullish + sentiment.bearish
        if (decisive === 0) return null
        return Math.round((sentiment.bullish / decisive) * 100) / 100
    }
    // Distance of current price from SMA20, expressed in ATR units.
    // Negative = price below SMA20 (oversold / mean-reversion buy zone).
    getMeanReversionScore(): MeanReversionResult {
        const atr = this.getATR()
        const smaResults = this.getSMA()
        const sma20 = smaResults.find((r) => r.name === 'sma20')
        const currentPrice = this.ohlcData[0]?.close
        if (!atr.value || !sma20?.value || currentPrice == null) {
            return { score: null, action: 'Neutral' }
        }
        const distance = currentPrice - (sma20.value as number)
        const score = Math.round((distance / (atr.value as number)) * 100) / 100
        const action: 'Bullish' | 'Bearish' | 'Neutral' =
            score < -1 ? 'Bullish' : score > 1 ? 'Bearish' : 'Neutral'
        return { score, action }
    }

    getPerStockFeatures() {
        const returns = this.getReturns()
        const volatility = this.getVolatility()
        const trendSlope = this.getTrendSlope()
        const gapMetrics = this.getGapMetrics()
        const tailRisk = this.getTailRisk()
        const maAlignment = this.getMAAlignmentScore()
        const momentumComposite = this.getMomentumComposite()
        const regime = this.getRegimeClass()
        const confluence = this.getConfluenceScore()
        const meanReversion = this.getMeanReversionScore()
        const sentiment = this.getOverallSentiment()

        return {
            returns,
            volatility,
            trendSlope,
            gapMetrics,
            tailRisk,
            maAlignmentScore: maAlignment,
            momentumComposite,
            regime,
            confluenceScore: confluence,
            meanReversion,
            sentiment,
        }
    }
}
