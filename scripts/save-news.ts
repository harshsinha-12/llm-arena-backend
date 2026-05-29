import dotenv from 'dotenv'
import { getIndexConstituents } from '../fetchers/constituents'
import { fetchNewsForStock } from '../fetchers/news'
import { getRedisClient } from '../redis/personal'
import { NIFTY_50_INDEX_CODE } from '../config/global'
import { newsKey } from '../config/redis'
import { getNameFromMBCode } from '../utils/codes'
dotenv.config()

export async function saveNews() {
    const mbCodes = await getIndexConstituents(NIFTY_50_INDEX_CODE)
    mbCodes.push('Y$Y')
    console.log(`Fetched ${mbCodes.length} Nifty 50 constituents`)
    const nameMap = await getNameFromMBCode(mbCodes)
    const client = await getRedisClient()
    try {
        for (const mbCode of mbCodes) {
            try {
                const name = nameMap[mbCode]
                if (!name) {
                    console.warn(`No name found for ${mbCode}, skipping`)
                    continue
                }
                const news = await fetchNewsForStock(mbCode, name)
                const key = newsKey(mbCode)
                await client.set(key, JSON.stringify(news))
                console.log(`Saved ${news.length} news items → ${key} (${name})`)
                await new Promise(resolve => setTimeout(resolve, 1000))
            } catch (err) {
                console.error(`Failed ${mbCode}:`, err)
            }
        }
    } finally {
        await client.quit()
    }
}
