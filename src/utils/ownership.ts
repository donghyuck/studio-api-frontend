export type OwnerIdentifier = number | string | null | undefined;

interface OwnerMatchOptions {
  /** true: identifier는 userId, false: identifier는 username */
  byId?: boolean;
  userId?: number | null;
  username?: string | null;
}

export function isOwner(
  identifier: OwnerIdentifier,
  options: OwnerMatchOptions = {}
): boolean {
  const { byId = true, userId, username } = options;
  if (identifier == null) return false;
  if (byId) {
    if (typeof identifier !== "number") return false;
    return userId != null && identifier === userId;
  }
  if (typeof identifier !== "string") return false;
  const trimmed = identifier.trim();
  if (!trimmed) return false;
  return !!username && trimmed === username.trim();
}
