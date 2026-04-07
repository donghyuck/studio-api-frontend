import { apiRequest } from "@/react/query/fetcher";
import type {
  BreadcrumbItem,
  BuildBreadcrumbOptions,
  BucketDto,
  ObjectInfoDto,
  ObjectListItemDto,
  ObjectListResponse,
  PresignedUrlDto,
  ProviderDto,
} from "@/types/studio/storage";

const fetchUrl = "/api/mgmt/objectstorage/providers";
const MIN_LIMIT = 200;

async function fetchProviders(): Promise<ProviderDto[]> {
  return apiRequest<ProviderDto[]>("get", fetchUrl);
}

async function fetchBuckets(params: {
  providerId: string;
}): Promise<BucketDto[]> {
  const { providerId } = params;
  return apiRequest<BucketDto[]>(
    "get",
    `${fetchUrl}/${encodeURIComponent(providerId)}/buckets/`
  );
}

async function fetchObjects(params: {
  providerId: string;
  bucket: string;
  prefix?: string | null;
  delimiter?: string | null;
  token?: string | null;
  size?: number;
}): Promise<ObjectListResponse> {
  const { providerId, bucket, size, ...rest } = params;
  return apiRequest<ObjectListResponse>(
    "get",
    `${fetchUrl}/${encodeURIComponent(providerId)}/buckets/${encodeURIComponent(bucket)}/objects`,
    { params: { delimiter: "/", size: size ?? MIN_LIMIT, ...rest } }
  );
}

async function fetchObjectHead(params: {
  providerId: string;
  bucket: string;
  key: string;
}) {
  const { providerId, bucket, key } = params;
  return apiRequest<ObjectInfoDto>(
    "get",
    `${fetchUrl}/${encodeURIComponent(providerId)}/buckets/${encodeURIComponent(bucket)}/object`,
    { params: { key } }
  );
}

async function presignGet(params: {
  providerId: string;
  bucket: string;
  key: string;
  ttl?: number;
  filename?: string;
  disposition?: "inline" | "attachment";
  contentType?: string;
}) {
  const { providerId, bucket, ...query } = params;
  return apiRequest<PresignedUrlDto>(
    "get",
    `${fetchUrl}/${encodeURIComponent(providerId)}/buckets/${encodeURIComponent(bucket)}/object:presigned-get`,
    { params: query }
  );
}

function toRows(
  response: ObjectListResponse,
  includeFolders: boolean
): ObjectListItemDto[] {
  const folders = includeFolders
    ? (response.commonPrefixes ?? []).map(
        (folder) => ({ key: folder, folder: true }) as ObjectListItemDto
      )
    : [];
  return folders.concat(response.items ?? []);
}

function hasMore(truncated?: boolean, nextToken?: string | null): boolean {
  return !!truncated && !!nextToken;
}

function buildBreadcrumb(
  prefix: string | undefined | null,
  options: BuildBreadcrumbOptions = {}
): BreadcrumbItem[] {
  const {
    rootLabel = "root",
    rootDisabled = false,
    lastDisabled = true,
    decodeLabel = true,
    maxDepth,
  } = options;

  const raw = (prefix ?? "").trim();
  const normalized = raw.length === 0 ? "" : raw.replace(/\/+/g, "/");
  const parts = normalized.split("/").filter(Boolean);

  const crumbs: BreadcrumbItem[] = [
    { label: rootLabel, prefix: "", disabled: rootDisabled },
  ];
  if (parts.length === 0) return crumbs;

  let accumulatedPrefix = "";
  const limit =
    typeof maxDepth === "number"
      ? Math.max(0, Math.min(parts.length, maxDepth))
      : parts.length;

  for (let index = 0; index < limit; index++) {
    const part = parts[index];
    if (part == null) continue;
    accumulatedPrefix += `${part}/`;

    const label = decodeLabel ? safeDecode(part) : part;
    const isLast = index === limit - 1 && limit === parts.length;

    crumbs.push({
      label,
      prefix: accumulatedPrefix,
      disabled: isLast ? lastDisabled : false,
    });
  }

  if (typeof maxDepth === "number" && maxDepth < parts.length) {
    const last = crumbs[crumbs.length - 1];
    if (last) last.disabled = true;
  }

  return crumbs;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function downloadFile(
  providerId: string,
  bucket: string,
  key: string,
  fileName?: string
) {
  const { url } = await presignGet({
    providerId,
    bucket,
    key,
    disposition: "attachment",
    filename: fileName ?? key.split("/").pop(),
  });
  if (!url) return;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const blob = await response.blob();
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = fileName ?? key.split("/").pop() ?? "download";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(anchor.href);
}

async function openInNewTab(providerId: string, bucket: string, key: string) {
  const { url } = await presignGet({
    providerId,
    bucket,
    key,
    disposition: "inline",
  });
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

export const reactObjectStorageApi = {
  fetchProviders,
  fetchBuckets,
  fetchObjects,
  fetchObjectHead,
  presignGet,
  buildBreadcrumb,
  toRows,
  hasMore,
  downloadFile,
  openInNewTab,
};
