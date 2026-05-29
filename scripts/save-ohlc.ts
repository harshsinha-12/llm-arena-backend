import dotenv from "dotenv";
import { getIndexConstituents } from "../fetchers/constituents";
import { getOHLC } from "../fetchers/ohlc";
import { getRedisClient } from "../redis/personal";
import { NIFTY_50_INDEX_CODE } from "../config/global";
import { ohlcKey } from "../config/redis";
import { GraphDuration } from "../types/global";
dotenv.config();

const DURATIONS: GraphDuration[] = ['1Y'];

export async function saveOHLC() {
    const mbCodes = await getIndexConstituents(NIFTY_50_INDEX_CODE);
    console.log(`Fetched ${mbCodes.length} Nifty 50 constituents`);
    const client = await getRedisClient();
    try {
        await Promise.all(
            mbCodes.flatMap((mbCode) =>
                DURATIONS.map(async (duration) => {
                    try {
                        const ohlc = await getOHLC({ mbCode, duration });
                        const key = ohlcKey(mbCode, duration);
                        await client.set(key, JSON.stringify(ohlc));
                        console.log(`Saved ${ohlc.length} records → ${key}`);
                    } catch (err) {
                        console.error(`Failed ${mbCode} ${duration}:`, err);
                    }
                })
            )
        );
    } finally {
        await client.quit();
    }
}
