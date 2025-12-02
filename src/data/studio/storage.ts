import { api } from "@/utils/http";
import type {
  ProviderDto,
  BucketDto,
  ObjectListResponse,
  ObjectListItemDto,
  PresignedUrlDto,
  ObjectInfoDto,
} from "@/types/studio/storage";

const fetchUrl = "/api/mgmt/objectstorage/providers";

export async function fetchProviders(): Promise<ProviderDto[]> {
  const payload = await api.get<[ProviderDto]>(fetchUrl);
  return payload;
}

export async function fetchBuckets(params: {
  providerId: string;
}): Promise<BucketDto[]> {
  const { providerId } = params;
  const data = await api.get<BucketDto[]>(
    `${fetchUrl}/${encodeURIComponent(providerId)}/buckets/`
  );
  return data;
}
const MIN_LIMIT = 200;
export async function fetchObjects(params: {
  providerId: string;
  bucket: string;
  prefix?: string | null;
  delimiter?: string | null; // 기본 "/"
  token?: string | null;
  size?: number; // 1~1000
}): Promise<ObjectListResponse> {
  const { providerId, bucket, size, ...rest } = params;
  const data = await api.get<ObjectListResponse>(
    `${fetchUrl}/${encodeURIComponent(providerId)}/buckets/${encodeURIComponent(bucket)}/objects`,
    { params: { delimiter: "/", size: size ?? MIN_LIMIT, ...rest } }
  );
  return data;
}

export async function fetchObjectHead(params: {
  providerId: string;
  bucket: string;
  key: string;
}) {
  const { providerId, bucket, key } = params;
  const data = await api.get<ObjectInfoDto>(
    `${fetchUrl}/${encodeURIComponent(providerId)}/buckets/${encodeURIComponent(bucket)}/object`,
    { params: { key } }
  );
  return data;
}

export async function presignGet(params: {
  providerId: string;
  bucket: string;
  key: string;
  ttl?: number;
  filename?: string;
  disposition?: "inline" | "attachment";
  contentType?: string;
}) {
  const { providerId, bucket, ...q } = params;
  const data = await api.get<PresignedUrlDto>(
    `${fetchUrl}/${encodeURIComponent(providerId)}/buckets/${encodeURIComponent(bucket)}/object:presigned-get`,
    { params: q }
  );
  return data;
}

export function toRows(
  res: ObjectListResponse,
  includeFolders: boolean
): ObjectListItemDto[] {
  const folders = includeFolders
    ? (res.commonPrefixes ?? []).map(
        (f) => ({ key: f, folder: true }) as ObjectListItemDto
      )
    : [];
  return folders.concat(res.items ?? []);
}

export function hasMore(
  truncated?: boolean,
  nextToken?: string | null
): boolean {
  return !!truncated && !!nextToken;
}

export interface BreadcrumbItem {
  label: string;
  prefix: string;
  disabled?: boolean;
}

export interface BuildBreadcrumbOptions {
  rootLabel?: string; // 기본 "root"
  rootDisabled?: boolean; // 기본 false
  lastDisabled?: boolean; // 기본 true (마지막은 클릭 비활성)
  decodeLabel?: boolean; // 기본 true (URL 인코딩된 segment 디코드)
  maxDepth?: number; // 기본 무제한 (너무 깊을 때 제한)
}
/**
 * prefix로 브레드크럼 생성
 *  - "a/b/c/" → [root, a, b, c]
 *  - 마지막 아이템은 기본 비활성(disabled)
 */
export function buildBreadcrumb(
  prefix: string | undefined | null,
  opts: BuildBreadcrumbOptions = {}
): BreadcrumbItem[] {
  const {
    rootLabel = "root",
    rootDisabled = false,
    lastDisabled = true,
    decodeLabel = true,
    maxDepth,
  } = opts;

  const raw = (prefix ?? "").trim();
  const normalized = raw.length === 0 ? "" : raw.replace(/\/+/g, "/"); // 중복 슬래시 정리
  const parts = normalized.split("/").filter(Boolean);

  const crumbs: BreadcrumbItem[] = [
    { label: rootLabel, prefix: "", disabled: rootDisabled },
  ];
  if (parts.length === 0) return crumbs;

  let acc = "";
  const limit =
    typeof maxDepth === "number"
      ? Math.max(0, Math.min(parts.length, maxDepth))
      : parts.length;

  for (let i = 0; i < limit; i++) {
    const part = parts[i];
    acc += part + "/";

    const label = decodeLabel ? safeDecode(part) : part;
    const isLast = i === limit - 1 && limit === parts.length;

    crumbs.push({
      label,
      prefix: acc,
      disabled: isLast ? lastDisabled : false,
    });
  }
  // maxDepth로 잘린 경우 마지막을 비활성 처리(선택)
  if (typeof maxDepth === "number" && maxDepth < parts.length) {
    const last = crumbs[crumbs.length - 1];
    if (last) last.disabled = true;
  }

  return crumbs;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export async function downloadFile(
  pid: string,
  bucket: string,
  key: string,
  fileName?: string
) {
  const { url } = await presignGet({
    providerId: pid,
    bucket,
    key,
    disposition: "attachment",
    filename: fileName ?? key.split("/").pop(),
  });
  if (!url) return;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
  const blob = await resp.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName ?? key.split("/").pop() ?? "download";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

export async function openInNewTab(pid: string, bucket: string, key: string) {
  const { url } = await presignGet({
    providerId: pid,
    bucket,
    key,
    disposition: "inline",
  });
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

export function toVuetifyBreadcrumbs(items: BreadcrumbItem[]) {
  return items.map((i) => ({
    text: i.label,
    disabled: !!i.disabled,
    prefix: i.prefix,
  }));
}
