import { createClient } from "redis";

const memoryCache = new Map();
let redisClientPromise = null;

const getRedisClient = async () => {
    const redisUrl = process.env.REDIS_URL || "";
    if (!redisUrl) return null;

    if (!redisClientPromise) {
        const client = createClient({ url: redisUrl });
        client.on("error", (error) => console.error("Redis cache client error:", error.message));
        redisClientPromise = client.connect().then(() => client).catch((error) => {
            redisClientPromise = null;
            console.error("Redis cache disabled:", error.message);
            return null;
        });
    }

    return redisClientPromise;
};

const readMemoryCache = (key) => {
    const cached = memoryCache.get(key);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
        memoryCache.delete(key);
        return null;
    }
    return cached.value;
};

export const getCache = async (key) => {
    const redis = await getRedisClient();
    if (redis) {
        const raw = await redis.get(key);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    return readMemoryCache(key);
};

export const setCache = async (key, value, ttlMs = 10_000) => {
    const redis = await getRedisClient();
    if (redis) {
        await redis.set(key, JSON.stringify(value), { PX: ttlMs });
        return;
    }

    memoryCache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
    });
};

export const deleteCacheByPrefix = async (prefix) => {
    for (const key of memoryCache.keys()) {
        if (key.startsWith(prefix)) memoryCache.delete(key);
    }

    const redis = await getRedisClient();
    if (!redis) return;

    for await (const key of redis.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) {
        await redis.del(key);
    }
};
