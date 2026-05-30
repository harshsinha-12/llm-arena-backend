import { GraphDuration } from "../types/global";

export const REDIS_KEY_PREFIX = {
    OHLC: "ohlc",
    TECHNICALS: "technicals",
    NEWS: "news",
    CONSTITUENTS: "constituents",
} as const;

export function ohlcKey(mbCode: string, duration: GraphDuration): string {
    return `${REDIS_KEY_PREFIX.OHLC}:${mbCode}:${duration}`;
}

export function technicalsKey(mbCode: string): string {
    return `${REDIS_KEY_PREFIX.TECHNICALS}:${mbCode}`;
}

export function newsKey(mbCode: string): string {
    return `${REDIS_KEY_PREFIX.NEWS}:${mbCode}`;
}

export function constituentsKey(indexMBCode: string): string {
    return `${REDIS_KEY_PREFIX.CONSTITUENTS}:${indexMBCode}`;
}

// ── Arena Keys ───────────────────────────────────────────────────────────

export function runConfigKey(runId: string): string {
    return `run:${runId}:config`;
}

export function tickSnapshotKey(runId: string, date: string): string {
    return `run:${runId}:tick:${date}:snapshot`;
}

export function leaderboardKey(runId: string): string {
    return `run:${runId}:leaderboard:latest`;
}

export function modelStateKey(runId: string, modelId: string): string {
    return `run:${runId}:model:${modelId}:state`;
}

export function modelChatKey(runId: string, modelId: string): string {
    return `run:${runId}:model:${modelId}:chat`;
}

export function modelOrdersKey(runId: string, modelId: string): string {
    return `run:${runId}:model:${modelId}:orders`;
}

export function modelTradesKey(runId: string, modelId: string): string {
    return `run:${runId}:model:${modelId}:trades`;
}

export function xsecRanksKey(date: string): string {
    return `xsec:${date}:ranks`;
}
