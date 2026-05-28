import IORedis from 'ioredis'
import dotenv from 'dotenv'
dotenv.config()

export const redisBull = new IORedis(process.env.REDIS_URL_BULL!, {
    maxRetriesPerRequest: null,
})

export const redisCache = new IORedis(process.env.REDIS_URL_CACHE!, {
    maxRetriesPerRequest: null,
})