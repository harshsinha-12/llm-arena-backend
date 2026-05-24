import dotenv from "dotenv";
import { getIndexConstituents } from "../fetchers/constituents";
import { getRedisClient } from "../redis/personal";
import { NIFTY_50_INDEX_CODE } from "../config/global";
import { constituentsKey } from "../config/redis";
dotenv.config();

export async function saveConstituents() {
    const mbCodes = await getIndexConstituents(NIFTY_50_INDEX_CODE);
    console.log(`Fetched ${mbCodes.length} Nifty 50 constituents`);
    const client = await getRedisClient();
    try {
        const key = constituentsKey(NIFTY_50_INDEX_CODE);
        await client.set(key, JSON.stringify(mbCodes));
        console.log(`Saved ${mbCodes.length} constituents → ${key}`);
    } finally {
        await client.quit();
    }
}