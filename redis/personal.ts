import { createClient } from "redis";
import dotenv from "dotenv";
dotenv.config();

export async function getRedisClient() {
    const client = createClient({
        username: process.env.REDIS_USERNAME,
        password: process.env.REDIS_PASSWORD,
        socket: {
            host: process.env.REDIS_HOST,
            port: Number(process.env.REDIS_PORT),
        }
    });
    await client.connect();
    console.log("Redis connected");
    return client;
}
