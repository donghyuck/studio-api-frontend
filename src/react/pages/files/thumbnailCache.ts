import { reactFilesApi } from "./api";

type ThumbnailCacheEntry = {
  url?: string | null;
  promise?: Promise<string | null>;
  unavailableUntil?: number;
};

const thumbnailCache = new Map<number, ThumbnailCacheEntry>();
const THUMBNAIL_RETRY_INTERVAL_MS = 1500;
const THUMBNAIL_RETRY_LIMIT = 6;
const THUMBNAIL_MISSING_TTL_MS = 30_000;

export function getCachedThumbnailUrl(attachmentId: number) {
  const entry = thumbnailCache.get(attachmentId);
  if (!entry) {
    return undefined;
  }
  if (entry.url === null && entry.unavailableUntil && entry.unavailableUntil < Date.now()) {
    thumbnailCache.delete(attachmentId);
    return undefined;
  }
  return entry.url;
}

export function invalidateThumbnail(attachmentId: number) {
  const entry = thumbnailCache.get(attachmentId);
  if (entry) {
    if (entry.url) {
      URL.revokeObjectURL(entry.url);
    }
    thumbnailCache.delete(attachmentId);
  }
}

export async function requestThumbnail(attachmentId: number, size = 256) {
  const cached = getCachedThumbnailUrl(attachmentId);
  if (cached !== undefined) {
    return cached;
  }

  const existing = thumbnailCache.get(attachmentId);
  if (existing?.promise) {
    return existing.promise;
  }

  const promise = new Promise<string | null>((resolve) => {
    let attempt = 0;

    function markUnavailable() {
      thumbnailCache.set(attachmentId, {
        url: null,
        unavailableUntil: Date.now() + THUMBNAIL_MISSING_TTL_MS,
      });
      resolve(null);
    }

    function load() {
      reactFilesApi
        .fetchThumbnail(attachmentId, size)
        .then((blob) => {
          if (blob.size === 0) {
            if (attempt < THUMBNAIL_RETRY_LIMIT) {
              attempt += 1;
              window.setTimeout(load, THUMBNAIL_RETRY_INTERVAL_MS);
            } else {
              markUnavailable();
            }
            return;
          }
          const nextUrl = URL.createObjectURL(blob);
          thumbnailCache.set(attachmentId, { url: nextUrl });
          resolve(nextUrl);
        })
        .catch(() => {
          if (attempt < THUMBNAIL_RETRY_LIMIT) {
            attempt += 1;
            window.setTimeout(load, THUMBNAIL_RETRY_INTERVAL_MS);
          } else {
            markUnavailable();
          }
        });
    }

    load();
  });

  thumbnailCache.set(attachmentId, { promise });
  return promise;
}
