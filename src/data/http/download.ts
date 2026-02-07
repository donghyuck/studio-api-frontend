/**
 * Content-Disposition 헤더에서 파일명을 파싱합니다.
 * RFC 5987 형식(filename*)과 일반 filename 모두 지원.
 */
export function parseFilenameFromContentDisposition(
  header?: string | null
): string | undefined {
  if (!header) return undefined;
  // filename*=UTF-8''<url-encoded>
  const star = header.match(/filename\*\=([^']*)''([^;]+)/i)?.[2];
  if (star) return decodeURIComponent(star);

  // filename="<quoted>"
  const quoted = header.match(/filename\=\"([^"]+)\"/i)?.[1];
  if (quoted) return quoted;

  // filename=<bare>
  const bare = header.match(/filename\=([^;]+)/i)?.[1];
  if (bare) return bare;

  return undefined;
}

/**
 * 브라우저에서 Blob을 파일로 저장합니다.
 * (Node/SSR 환경이 아니어야 합니다)
 */
export function saveBlob(blob: Blob, filename = "download.bin"): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
