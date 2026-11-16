import { LRUCache } from "lru-cache";

/**
 * Tiny in-process cache for hot catalogue reads. Combined with HTTP cache
 * headers + the Next.js data cache this keeps pages fast even with a big
 * catalogue. Swap for Redis when running several API instances.
 */
const cache = new LRUCache<string, { value: unknown }>({ max: 2000, ttl: 60_000 });

export async function cached<T>(key: string, fn: () => Promise<T>, ttl = 60_000): Promise<T> {
  const hit = cache.get(key);
  if (hit) return hit.value as T;
  const value = await fn();
  cache.set(key, { value }, { ttl });
  return value;
}

export function invalidate(prefix?: string) {
  if (!prefix) return cache.clear();
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
}
