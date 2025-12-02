// src/utils/filename.ts

/** URL에서 빠르게 이름만 추정 (동기) */
export function guessFilenameFromUrl(
  url?: string,
  fallback = "avatar.jpg"
): string {
  if (!url) return fallback;
  try {
    const u = new URL(url, window.location.href);
    let name = u.pathname.split("/").filter(Boolean).pop() || "";
    if (!name || !name.includes(".")) {
      name = u.searchParams.get("filename") || u.searchParams.get("name") || "";
    }
    return decodeURIComponent(name || fallback);
  } catch {
    return fallback;
  }
}

/** Content-Disposition 파서 (정확 이름) */
export function parseFilenameFromContentDisposition(
  header?: string | null
): string | null {
  if (!header) return null;
  let m = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (m?.[1]) return decodeURIComponent(m[1]);
  m =
    /filename\s*=\s*"([^"]+)"/i.exec(header) ||
    /filename\s*=\s*([^;]+)/i.exec(header);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

/**
 * 보호 리소스면 HEAD/GET으로 Content-Disposition을 읽어 정확 파일명을 시도.
 * 실패 시 URL 추정으로 폴백.
 */
export async function filenameFromUrl(
  url?: string,
  opts?: {
    protected?: boolean;
    token?: string;
    fallback?: string;
    method?: "HEAD" | "GET";
  }
): Promise<string> {
  const fallback = opts?.fallback ?? "avatar.jpg";
  if (!url) return fallback;
  if (!opts?.protected) return guessFilenameFromUrl(url, fallback);
  try {
    console.log("Fetching headers for filename:", url, opts?.method);
    const res = await fetch(url, {
      method: opts?.method ?? "HEAD",
      headers: opts?.token ? { Authorization: `Bearer ${opts.token}` } : {},
    });
    if (res.ok) {
      const disp = res.headers.get("Content-Disposition");
      const parsed = parseFilenameFromContentDisposition(disp);
      console.log("Parsed filename from Content-Disposition:", parsed);
      if (parsed) return parsed;
    }
  } catch {
    /* ignore */
  }

  return guessFilenameFromUrl(url, fallback);
}
