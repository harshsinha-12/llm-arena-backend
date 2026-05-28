import zlib from "zlib";
import { differenceInDays, isSameDay, subDays, subYears } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import {
  CMOTS_10Y,
  CMOTS_1D,
  CMOTS_1Y,
  CMOTS_3Y,
  CMOTS_5Y,
  CMOTS_BSE_HISTORICAL_PRICE_FEED,
  CMOTS_DURATIONS_MAP,
  CMOTS_NSE_HISTORICAL_PRICE_FEED,
  HISTORICAL_PRICE_FEED_KEY,
  IST_TIME_ZONE,
  OHLC_CLOSE,
  OHLC_DATE,
  OHLC_HIGH,
  OHLC_LOW,
  OHLC_OPEN,
} from "../config/global";
import {
  CmotsIndexStockOhlc,
  GraphDuration,
  MBCode,
  OHLC,
} from "../types/global";
import { redisCache } from "../redis/mbai";
import { getMarketTimings } from "../utils/market";
import { generateRedisKey, getCMOTSCodeFromMBCode } from "../utils/codes";
import axiosInstance from "./axios";
import { getQuotes } from "./quotes";

export const getOHLC = async ({
  mbCode = "",
  returnItems = [OHLC_DATE, OHLC_OPEN, OHLC_HIGH, OHLC_LOW, OHLC_CLOSE],
  duration,
}: {
  mbCode?: MBCode;
  returnItems?: string[];
  duration: GraphDuration;
}): Promise<OHLC[]> => {
  if (!mbCode) throw new Error("mbCode is null");
  if (duration === CMOTS_1D) throw new Error("1D duration is not supported");
  const redisKey = `global:getOHLC:V1:${generateRedisKey(mbCode, returnItems, duration)}`;
  const cachedData = await redisCache.get(redisKey);
  const shouldCompress = [CMOTS_1Y, CMOTS_3Y, CMOTS_5Y, CMOTS_10Y].includes(
    duration,
  );
  if (cachedData) {
    if (shouldCompress) {
      if (cachedData.startsWith("H4sIA")) {
        const buffer = Buffer.from(cachedData, "base64");
        const decompressed = zlib
          .gunzipSync(new Uint8Array(buffer))
          .toString("utf-8");
        return JSON.parse(decompressed);
      }
      return JSON.parse(cachedData);
    } else {
      return JSON.parse(cachedData);
    }
  }
  let ohlc: OHLC[];
  const toDate = new Date();
  const fromDate = subDays(toDate, CMOTS_DURATIONS_MAP[duration].days);
  const historicalFeed = await getHistoricalOHLCFeed(mbCode, fromDate, toDate);
  if (!historicalFeed.length)
    throw new Error(`No data found for ${mbCode} for ${duration}`);
  ohlc = historicalFeed.map((item: OHLC) =>
    returnItems.reduce((acc, field) => {
      if (field === OHLC_DATE) acc.datetime = item.datetime;
      if (field === OHLC_OPEN) acc.open = item.open;
      if (field === OHLC_HIGH) acc.high = item.high;
      if (field === OHLC_LOW) acc.low = item.low;
      if (field === OHLC_CLOSE) acc.close = item.close;
      return acc;
    }, {} as OHLC),
  );
  const res = ohlc.sort(
    (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
  );
  return res;
};

export const getHistoricalFeed = async (
  mbCode: MBCode,
): Promise<{ data: any; status: number; ok: boolean }> => {
  const cacheKey = `${HISTORICAL_PRICE_FEED_KEY}:${mbCode}`;
  const cacheExists = await redisCache.exists(cacheKey);
  if (cacheExists) {
    const data = await redisCache.get(cacheKey);
    return JSON.parse(data!);
  } else {
    const today = formatInTimeZone(new Date(), IST_TIME_ZONE, "dd-MMM-yyyy");
    const tenYearsAgo = formatInTimeZone(
      subYears(new Date(), 10),
      IST_TIME_ZONE,
      "dd-MMM-yyyy",
    );
    const cmotsCode = (await getCMOTSCodeFromMBCode([mbCode]))[mbCode];
    const res = await axiosInstance.get(
      `${CMOTS_BSE_HISTORICAL_PRICE_FEED}${cmotsCode}/${tenYearsAgo}/${today}`,
    );
    let data: { data: CmotsIndexStockOhlc[] } = res.data;
    const eodohlcArray = data.data ?? [];
    if (!eodohlcArray.length) {
      const res = await axiosInstance.get(
        `${CMOTS_NSE_HISTORICAL_PRICE_FEED}${cmotsCode}/${tenYearsAgo}/${today}`,
      );
      data = res.data;
    }
    const response = {
      data,
      status: res.status,
      ok: res.statusText === "OK",
    };
    return response;
  }
};

const getHistoricalOHLCFeed = async (
  mbCode: MBCode,
  fromDate: Date,
  toDate: Date,
): Promise<OHLC[]> => {
  const res = await getHistoricalFeed(mbCode);
  let eodOHLCArray: CmotsIndexStockOhlc[] = res.data.data ?? [];
  eodOHLCArray = eodOHLCArray.filter(
    (item) =>
      fromZonedTime(item.TradeDate, IST_TIME_ZONE) >= fromDate &&
      fromZonedTime(item.TradeDate, IST_TIME_ZONE) <= toDate,
  );
  const ohlc: OHLC[] = eodOHLCArray.map((item) => ({
    datetime: getMarketTimings(
      "open",
      fromZonedTime(item.TradeDate, IST_TIME_ZONE),
    ),
    open: item.open,
    high: item.high,
    low: item.low,
    close: item.close,
  }));
  if (differenceInDays(toDate, new Date()) < 0) return ohlc;
  const quotes = await getQuotes({ mbCodes: mbCode });
  const latestDayAlreadyExists = ohlc.some((item) =>
    isSameDay(item.datetime, quotes[0].datetime),
  );
  !latestDayAlreadyExists &&
    ohlc.push({
      datetime: quotes[0].datetime,
      open: quotes[0].open ?? NaN,
      high: quotes[0].high ?? NaN,
      low: quotes[0].low ?? NaN,
      close: quotes[0].price,
    });
  return ohlc;
};
