import dotenv from "dotenv";
import { getIndexConstituents } from "../fetchers/constituents";
import { getRedisClient } from "../redis/personal";
import { NIFTY_50_INDEX_CODE } from "../config/global";
import { newsKey } from "../config/redis";
import { fetchNewsForStock } from "../fetchers/news";
import { getNameFromMBCode } from "../utils/codes";
dotenv.config();

const BATCH_SIZE = 10;

export async function saveNews() {
    const mbCodes = await getIndexConstituents(NIFTY_50_INDEX_CODE);
    console.log(`Fetched ${mbCodes.length} Nifty 50 constituents`);
    const nameMap = await getNameFromMBCode(mbCodes);
    const client = await getRedisClient();
    try {
        for (let i = 0; i < mbCodes.length; i += BATCH_SIZE) {
            const batch = mbCodes.slice(i, i + BATCH_SIZE);
            await Promise.all(
                batch.map(async (mbCode) => {
                    try {
                        const name = nameMap[mbCode] || "";
                        const news = await fetchNewsForStock(mbCode, name);
                        const key = newsKey(mbCode);
                        await client.set(key, JSON.stringify(news));
                        console.log(`Saved News → ${key}`);
                    } catch (err) {
                        console.error(`Failed news for ${mbCode}:`, err);
                    }
                })
            );
        }
    } finally {
        await client.quit();
    }
}
