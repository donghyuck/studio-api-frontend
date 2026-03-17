export type JwtPayload = Record<string, unknown> & {
  exp?: number;
};

function decodeBase64Url(base64Url: string): string {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return atob(padded);
}

export function parseJwtPayload(
  token: string | null | undefined
): JwtPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payloadPart = parts[1];
  if (!payloadPart) return null;
  try {
    return JSON.parse(decodeBase64Url(payloadPart)) as JwtPayload;
  } catch {
    return null;
  }
}

export function parseJwtExp(token: string | null | undefined): number | null {
  const payload = parseJwtPayload(token);
  return typeof payload?.exp === "number" ? payload.exp : null;
}

