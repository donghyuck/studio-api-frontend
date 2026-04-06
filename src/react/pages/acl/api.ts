import { apiRequest } from "@/react/query/fetcher";
import type {
  AclClassDto,
  AclClassRequest,
  AclEntryDto,
  AclEntryRequest,
  AclObjectIdentityDto,
  AclObjectIdentityRequest,
  AclSidDto,
  AclSidRequest,
} from "@/types/studio/acl";
import type { AclActionMaskDto } from "@/types/studio/ai";
import type { PageResponse } from "@/types/studio/api-common";

const API_BASE = "/api/security/acl/admin";

function compareValues(left: unknown, right: unknown) {
  if (left == null && right == null) return 0;
  if (left == null) return -1;
  if (right == null) return 1;

  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left).localeCompare(String(right));
}

function toPageResponse<T>(
  items: T[],
  page: number,
  size: number,
  sort?: string
): PageResponse<T> {
  let sortedItems = [...items];

  if (sort) {
    const [field, direction = "asc"] = sort.split(",");
    sortedItems.sort((left, right) => {
      const leftValue = (left as Record<string, unknown>)[field];
      const rightValue = (right as Record<string, unknown>)[field];
      const result = compareValues(leftValue, rightValue);
      return direction === "desc" ? -result : result;
    });
  }

  const start = page * size;
  const content = sortedItems.slice(start, start + size);
  const totalElements = sortedItems.length;
  const totalPages = totalElements === 0 ? 1 : Math.ceil(totalElements / size);

  return {
    content,
    totalElements,
    totalPages,
    size,
    number: page,
    numberOfElements: content.length,
    first: page === 0,
    last: page >= totalPages - 1,
    empty: totalElements === 0,
  };
}

export const reactAclApi = {
  listClasses: () => apiRequest<AclClassDto[]>("get", `${API_BASE}/classes`),
  listClassesPage: async (params?: { page?: number; size?: number; sort?: string }) =>
    toPageResponse(await reactAclApi.listClasses(), params?.page ?? 0, params?.size ?? 20, params?.sort),
  createClass: (payload: AclClassRequest) =>
    apiRequest<AclClassDto>("post", `${API_BASE}/classes`, { data: payload }),
  deleteClass: (id: number) => apiRequest<void>("delete", `${API_BASE}/classes/${id}`),

  listSids: () => apiRequest<AclSidDto[]>("get", `${API_BASE}/sids`),
  listSidsPage: async (params?: { page?: number; size?: number; sort?: string }) =>
    toPageResponse(await reactAclApi.listSids(), params?.page ?? 0, params?.size ?? 20, params?.sort),
  createSid: (payload: AclSidRequest) =>
    apiRequest<AclSidDto>("post", `${API_BASE}/sids`, { data: payload }),
  deleteSid: (id: number) => apiRequest<void>("delete", `${API_BASE}/sids/${id}`),

  listObjects: () => apiRequest<AclObjectIdentityDto[]>("get", `${API_BASE}/objects`),
  listObjectsPage: async (params?: { page?: number; size?: number; sort?: string }) =>
    toPageResponse(await reactAclApi.listObjects(), params?.page ?? 0, params?.size ?? 20, params?.sort),
  createObject: (payload: AclObjectIdentityRequest) =>
    apiRequest<AclObjectIdentityDto>("post", `${API_BASE}/objects`, { data: payload }),
  deleteObject: (id: number) => apiRequest<void>("delete", `${API_BASE}/objects/${id}`),

  listEntries: () => apiRequest<AclEntryDto[]>("get", `${API_BASE}/entries`),
  listEntriesPage: async (params?: { page?: number; size?: number; sort?: string }) =>
    toPageResponse(await reactAclApi.listEntries(), params?.page ?? 0, params?.size ?? 20, params?.sort),
  createEntry: (payload: AclEntryRequest) =>
    apiRequest<AclEntryDto>("post", `${API_BASE}/entries`, { data: payload }),
  deleteEntry: (id: number) => apiRequest<void>("delete", `${API_BASE}/entries/${id}`),

  listActions: () => apiRequest<AclActionMaskDto[]>("get", `${API_BASE}/actions`),
};
