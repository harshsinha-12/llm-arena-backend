import axios from 'axios'
import { fromZonedTime } from 'date-fns-tz'
import { CMOTS_BSE_PRICE_FEED_URL, CMOTS_NSE_PRICE_FEED_URL, IST_TIME_ZONE } from "../config/global"
import { CmotsStockQuote, MBCode, StockQuote } from "../types/global"
import { redisCache } from "../redis/mbai"
import { getMarketTimings, getMktHrLinkedCachingTime } from "../utils/market"
import {
    generateRedisKey,
    getCMOTSCodeFromMBCode,
    getNameFromMBCode,
    getSymbolFromMBCode,
} from "../utils/codes"

export async function getQuotes({ mbCodes = '' }: { mbCodes: string }): Promise<StockQuote[]> {
    if (!mbCodes) throw new Error('MB Codes are null')
    const redisKey = `global:getQuotes:${generateRedisKey(mbCodes)}`
    const cacheExists = await redisCache.exists(redisKey)
    if (cacheExists) {
        const cachedData = await redisCache.get(redisKey)
        return JSON.parse(cachedData!)
    }
    const mbCodeList = mbCodes ? mbCodes.split(',').filter(Boolean) : []
    const res = await getStockQuotes(mbCodeList)
    return res
}

const getStockQuotes = async (mbCodes: MBCode[]): Promise<StockQuote[]> => {
    const [resNSE, resBSE, cmotsCodeMap, symbolMap, nameMap] = await Promise.all([
        fetchCached(CMOTS_NSE_PRICE_FEED_URL, getMktHrLinkedCachingTime()),
        fetchCached(CMOTS_BSE_PRICE_FEED_URL, getMktHrLinkedCachingTime()),
        getCMOTSCodeFromMBCode(mbCodes),
        getSymbolFromMBCode(mbCodes),
        getNameFromMBCode(mbCodes),
    ])
    const jsonNSE = resNSE.data
    const jsonBSE = resBSE.data
    const nseQuotes: CmotsStockQuote[] = jsonNSE.data
    const bseQuotes: CmotsStockQuote[] = jsonBSE.data
    const combinedQuotes = combineNSEBSEQuotes(nseQuotes, bseQuotes)
    const quotes: StockQuote[] = []
    for (const mbCode of mbCodes) {
        const entry = combinedQuotes.find((item: any) => item.co_code === cmotsCodeMap[mbCode])
        if (!entry) continue
        quotes.push({
            mbCode: mbCode,
            datetime: entry?.Tr_Date
                ? getMarketTimings('open', fromZonedTime(entry?.Tr_Date, IST_TIME_ZONE))
                : new Date(),
            symbol: symbolMap[mbCode] ?? '',
            name: nameMap[mbCode] ?? '',
            price: entry?.price ?? NaN,
            open: entry?.Open ?? NaN,
            high: entry?.High ?? NaN,
            low: entry?.Low ?? NaN,
            volume: entry?.Volume ?? NaN,
            change: entry?.Price_diff ?? NaN,
            changesPercentage: entry?.change ?? NaN,
        })
    }
    return quotes
}

export const fetchCached = async (
    url: string,
    time: number
): Promise<{ data: any; status: number; ok: boolean }> => {
    const cacheExists = await redisCache.exists(url)
    if (cacheExists) {
        const data = await redisCache.get(url)
        return JSON.parse(data!)
    } else {
        const res = await axios.get(url, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.CMOTS_TOKEN}`,
            },
            timeout: 5000,
        })
        const data = res.data
        const response = {
            data,
            status: res.status,
            ok: res.statusText === 'OK',
        }
        return response
    }
}

function combineNSEBSEQuotes(
    nseQuotes: CmotsStockQuote[],
    bseQuotes: CmotsStockQuote[]
): CmotsStockQuote[] {
    const combinedQuotes: CmotsStockQuote[] = []
    const bseMap = new Map<number, CmotsStockQuote>()
    bseQuotes.forEach((quote) => {
        bseMap.set(quote.co_code, quote)
    })
    nseQuotes.forEach((nseQuote) => {
        const bseQuote = bseMap.get(nseQuote.co_code)
        if (bseQuote) {
            combinedQuotes.push({
                ...bseQuote,
                Volume: (bseQuote.Volume ?? 0) + (nseQuote.Volume ?? 0),
            })
            bseMap.delete(nseQuote.co_code)
        } else {
            combinedQuotes.push(nseQuote)
        }
    })
    bseMap.forEach((bseQuote) => {
        combinedQuotes.push(bseQuote)
    })
    return combinedQuotes
}
