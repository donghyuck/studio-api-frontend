import { defineStore } from "pinia";
import { usersPublicApi } from "@/data/studio/public/user";
import type { UserPublicDto } from "@/types/studio/user";

type CacheEntry = {
  value: UserPublicDto;
  ts: number;
};

type FetchOptions = {
  ttlMs?: number;
  force?: boolean;
};

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export const usePublicUserBasicStore = defineStore("public-user-basic-store", () => {
  const cache = new Map<number, CacheEntry>();
  const pending = new Map<number, Promise<UserPublicDto>>();

  const isFresh = (entry: CacheEntry | undefined, ttlMs: number) => {
    if (!entry) return false;
    return Date.now() - entry.ts < ttlMs;
  };

  const getCached = (userId: number, ttlMs = DEFAULT_TTL_MS) => {
    const entry = cache.get(userId);
    if (isFresh(entry, ttlMs)) return entry?.value ?? null;
    return null;
  };

  const fetch = async (
    userId: number,
    opts: FetchOptions = {}
  ): Promise<UserPublicDto> => {
    const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
    if (!opts.force) {
      const cached = getCached(userId, ttlMs);
      if (cached) return cached;
    }

    const inflight = pending.get(userId);
    if (inflight) return inflight;

    const request = usersPublicApi
      .getUserById(userId)
      .then((basic) => {
        cache.set(userId, { value: basic, ts: Date.now() });
        return basic;
      })
      .finally(() => {
        pending.delete(userId);
      });

    pending.set(userId, request);
    return request;
  };

  const clear = () => {
    cache.clear();
    pending.clear();
  };

  return {
    fetch,
    getCached,
    clear,
  };
});
