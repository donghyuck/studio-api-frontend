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

export const usePublicUserStore = defineStore("public-user-store", () => {
  const cache = new Map<string, CacheEntry>();
  const pending = new Map<string, Promise<UserPublicDto>>();

  const isFresh = (entry: CacheEntry | undefined, ttlMs: number) => {
    if (!entry) return false;
    return Date.now() - entry.ts < ttlMs;
  };

  const getCached = (key: string, ttlMs = DEFAULT_TTL_MS) => {
    const entry = cache.get(key);
    if (isFresh(entry, ttlMs)) return entry?.value ?? null;
    return null;
  };

  const fetchByKey = async (
    key: string,
    request: () => Promise<UserPublicDto>,
    opts: FetchOptions = {}
  ): Promise<UserPublicDto> => {
    const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
    if (!opts.force) {
      const cached = getCached(key, ttlMs);
      if (cached) return cached;
    }
    const inflight = pending.get(key);
    if (inflight) return inflight;
    const promise = request()
      .then((user) => {
        cache.set(key, { value: user, ts: Date.now() });
        return user;
      })
      .finally(() => {
        pending.delete(key);
      });
    pending.set(key, promise);
    return promise;
  };

  const fetchById = (id: number | string, opts: FetchOptions = {}) => {
    const key = `id:${id}`;
    return fetchByKey(key, () => usersPublicApi.getUserById(id), opts);
  };

  const fetchByUsername = (username: string, opts: FetchOptions = {}) => {
    const trimmed = username.trim();
    const key = `name:${trimmed}`;
    return fetchByKey(key, () => usersPublicApi.getUserByUsername(trimmed), opts);
  };

  const clear = () => {
    cache.clear();
    pending.clear();
  };

  return {
    fetchById,
    fetchByUsername,
    getCached,
    clear,
  };
});
