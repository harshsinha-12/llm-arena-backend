import dotenv from "dotenv";
import { getIndexConstituents } from "../fetchers/constituents";
import { getRedisClient } from "../redis/personal";
import { NIFTY_50_INDEX_CODE } from "../config/global";
import { ohlcKey, technicalsKey } from "../config/redis";
import { OHLC } from "../types/global";
import { Technicals } from "../classes/technicals";
dotenv.config();

const BATCH_SIZE = 10;

export async function saveTechnicals() {
    const mbCodes = await getIndexConstituents(NIFTY_50_INDEX_CODE);
    console.log(`Fetched ${mbCodes.length} Nifty 50 constituents`);
    const client = await getRedisClient();
    try {
        for (let i = 0; i < mbCodes.length; i += BATCH_SIZE) {
            const batch = mbCodes.slice(i, i + BATCH_SIZE);
            await Promise.all(
                batch.map(async (mbCode) => {
                    try {
                        const raw = await client.get(ohlcKey(mbCode, "1Y"));
                        if (!raw) {
                            console.warn(`No OHLC data for ${mbCode}, skipping`);
                            return;
                        }
                        const ohlc: OHLC[] = JSON.parse(raw);
                        const technicals = new Technicals(ohlc);
                        const result = {
                            movingAverages: technicals.getMovingAverages(),
                            oscillators: technicals.getOscillators(),
                            overallSentiment: technicals.getOverallSentiment(),
                            perStockFeatures: technicals.getPerStockFeatures(),
                        };
                        const key = technicalsKey(mbCode);
                        await client.set(key, JSON.stringify(result));
                        console.log(`Saved technicals → ${key}`);
                    } catch (err) {
                        console.error(`Failed ${mbCode}:`, err);
                    }
                })
            );
        }
    } finally {
        await client.quit();
    }
}