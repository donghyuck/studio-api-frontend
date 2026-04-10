import type { PropertyOwnerType } from "@/react/api/properties";

export const RESERVED_PREFIXES = [
  "security.",
  "auth.",
  "role.",
  "admin.",
  "permission.",
] as const;

export const KEY_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/;

export function normalizeProperties(
  value: Record<string, string | null | undefined> | null | undefined
) {
  return Object.fromEntries(
    Object.entries(value ?? {}).map(([key, currentValue]) => [
      key,
      currentValue == null ? "" : String(currentValue),
    ])
  ) as Record<string, string>;
}

export function validatePropertyKey(
  key: string,
  type: PropertyOwnerType
): string | null {
  const normalizedKey = key.trim();

  if (!normalizedKey) {
    return "키를 입력해 주세요.";
  }

  if (!KEY_PATTERN.test(normalizedKey)) {
    return "키는 영문자, 숫자, _, ., - 만 사용하고 100자 이하여야 합니다.";
  }

  if (type === "users" && RESERVED_PREFIXES.some((prefix) => normalizedKey.startsWith(prefix))) {
    return `'${normalizedKey}'는 예약된 prefix를 사용할 수 없습니다.`;
  }

  return null;
}

export function diffProperties(
  initial: Record<string, string>,
  draft: Record<string, string>
) {
  const added: Record<string, string> = {};
  const updated: Record<string, string> = {};
  const removed: string[] = [];

  Object.entries(draft).forEach(([key, value]) => {
    if (!(key in initial)) {
      added[key] = value;
      return;
    }

    if (initial[key] !== value) {
      updated[key] = value;
    }
  });

  Object.keys(initial).forEach((key) => {
    if (!(key in draft)) {
      removed.push(key);
    }
  });

  return { added, updated, removed };
}
