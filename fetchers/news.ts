import axios from 'axios'
import { MBCode } from '../types/global'

const MBAI_NEWS_ARTICLES_URL = 'https://www.multibagg.ai/api/v1/news-articles'

export const fetchNewsForStock = async (mbCode: MBCode, name: string): Promise<any[]> => {
    const params = new URLSearchParams({
        mbCode,
        duration: '7d',
        companyName: name.replace(/\s+/g, ''),
    })
    const response = await axios.get(MBAI_NEWS_ARTICLES_URL, {
        params,
        timeout: 10000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Referer': 'https://www.multibagg.ai/',
            'Origin': 'https://www.multibagg.ai',
        },
    })
    const data = response?.data
    return Array.isArray(data) ? data : (data?.data ?? [])
}
