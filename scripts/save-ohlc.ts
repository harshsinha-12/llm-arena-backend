import dotenv from "dotenv";
import { getIndexConstituents } from "../fetchers/constituents";
import { getRedisClient } from "../redis/personal";
import { NIFTY_50_INDEX_CODE } from "../config/global";
import { ohlcKey } from "../config/redis";
import { getOHLC } from "../fetchers/ohlc";
dotenv.config();

const BATCH_SIZE = 10;

export async function saveOHLC() {
    const mbCodes = await getIndexConstituents(NIFTY_50_INDEX_CODE);
    console.log(`Fetched ${mbCodes.length} Nifty 50 constituents`);
    const client = await getRedisClient();
    try {
        for (let i = 0; i < mbCodes.length; i += BATCH_SIZE) {
            const batch = mbCodes.slice(i, i + BATCH_SIZE);
            await Promise.all(
                batch.map(async (mbCode) => {
                    try {
                        const ohlc = await getOHLC({ mbCode, duration: "1Y" });
                        const key = ohlcKey(mbCode, "1Y");
                        await client.set(key, JSON.stringify(ohlc));
                        console.log(`Saved OHLC → ${key}`);
                    } catch (err) {
                        console.error(`Failed OHLC for ${mbCode}:`, err);
                    }
                })
            );
        }
    } finally {
        await client.quit();
    }
}
