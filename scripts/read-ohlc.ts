import dotenv from "dotenv";
import { MBCode, OHLCDataPoint } from "../types/global";
import { getRedisClient } from "../redis/personal";
import { ohlcKey } from "../config/redis";
dotenv.config();

async function readOHLC(mbCode: MBCode) {
    const client = await getRedisClient();
    try {
        const key = ohlcKey(mbCode, "1Y");
        const raw = await client.get(key);
        if (!raw) {
            console.log("No OHLC data found. Run save-ohlc.ts first.");
            return;
        }
        const ohlc: OHLCDataPoint[] = JSON.parse(raw);
        console.log(`Read ${ohlc.length} OHLC records from Redis`);
        console.log("First 3 records:", ohlc.slice(0, 3));
    } finally {
        await client.quit();
    }
}

readOHLC("MBEQU5710").catch(console.error);
