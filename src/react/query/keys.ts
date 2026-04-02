import type { Id } from "@/types/studio/api-common";

type QueryKeyPrimitive = string | number | boolean | null;
type QueryKeyArrayValue = readonly QueryKeyPrimitive[];
type QueryKeyRecordValue = QueryKeyPrimitive | QueryKeyArrayValue | undefined;
type QueryKeyRecord = Record<string, QueryKeyRecordValue>;

const QUERY_KEY_ROOT = "studio";

function normalizeKeyRecord(params?: QueryKeyRecord) {
  if (!params) {
    return undefined;
  }

  const normalizedEntries = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => [
      key,
      Array.isArray(value) ? [...value] : value,
    ] as const);

  if (normalizedEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(normalizedEntries);
}

export function createQueryKeys(scope: string) {
  const baseKey = [QUERY_KEY_ROOT, scope] as const;

  return {
    all: baseKey,
    lists: () => [...baseKey, "list"] as const,
    list: (params?: QueryKeyRecord) =>
      [...baseKey, "list", normalizeKeyRecord(params)] as const,
    details: () => [...baseKey, "detail"] as const,
    detail: (id: Id) => [...baseKey, "detail", id] as const,
    custom: (...parts: QueryKeyPrimitive[]) => [...baseKey, ...parts] as const,
  };
}

export const appQueryKeys = {
  all: [QUERY_KEY_ROOT] as const,
  auth: {
    all: [QUERY_KEY_ROOT, "auth"] as const,
    session: () => [QUERY_KEY_ROOT, "auth", "session"] as const,
    currentUser: () => [QUERY_KEY_ROOT, "auth", "user", "me"] as const,
  },
};

