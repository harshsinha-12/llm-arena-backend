import {
    CMOTS_CODE_MBCODE_KEY,
    MBCODE_CMOTS_CODE_KEY,
    MBCODE_NAME_KEY,
    MBCODE_SYMBOL_KEY,
} from "../config/global"
import { redisCache } from "../redis/mbai"
import { CmotsCode, MBCode } from "../types/global"

export const generateRedisKey = (...args: any[]): string => {
    return args.map((arg) => JSON.stringify(arg)).join(':')
}

export const getMBCodeFromCmotsCode = async (
    cmotsCodes: CmotsCode[]
): Promise<Record<string, string>> => {
    'use server'
    if (cmotsCodes.length === 0) return {}
    const values = await redisCache.hmget(CMOTS_CODE_MBCODE_KEY, ...cmotsCodes.map(String))
    const result: Record<string, string> = {}
    cmotsCodes.forEach((cm, idx) => {
        const val = values[idx]
        result[cm] = val ? val : ''
    })
    return result
}

export const getCMOTSCodeFromMBCode = async (
    mbCodes: MBCode[]
): Promise<Record<string, number>> => {
    'use server'
    if (mbCodes.length === 0) return {}
    const values = await redisCache.hmget(MBCODE_CMOTS_CODE_KEY, ...mbCodes)
    const result: Record<string, number> = {}
    mbCodes.forEach((mb, idx) => {
        const val = values[idx]
        result[mb] = val ? parseInt(val) : NaN
    })
    return result
}

export const getSymbolFromMBCode = async (mbCodes: MBCode[]): Promise<Record<string, string>> => {
    'use server'
    if (mbCodes.length === 0) return {}
    const values = await redisCache.hmget(MBCODE_SYMBOL_KEY, ...mbCodes)
    const result: Record<string, string> = {}
    mbCodes.forEach((mb, idx) => {
        const val = values[idx]
        result[mb] = val ? val : ''
    })
    return result
}

export const getNameFromMBCode = async (mbCodes: MBCode[]): Promise<Record<string, string>> => {
    'use server'
    if (mbCodes.length === 0) return {}
    const values = await redisCache.hmget(MBCODE_NAME_KEY, ...mbCodes)
    const result: Record<string, string> = {}
    mbCodes.forEach((mb, idx) => {
        const val = values[idx]
        result[mb] = val ? val : ''
    })
    return result
}
