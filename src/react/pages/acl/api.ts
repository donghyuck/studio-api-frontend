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

const API_BASE = "/api/security/acl/admin";

export const reactAclApi = {
  listClasses: () => apiRequest<AclClassDto[]>("get", `${API_BASE}/classes`),
  createClass: (payload: AclClassRequest) =>
    apiRequest<AclClassDto>("post", `${API_BASE}/classes`, { data: payload }),
  deleteClass: (id: number) => apiRequest<void>("delete", `${API_BASE}/classes/${id}`),

  listSids: () => apiRequest<AclSidDto[]>("get", `${API_BASE}/sids`),
  createSid: (payload: AclSidRequest) =>
    apiRequest<AclSidDto>("post", `${API_BASE}/sids`, { data: payload }),
  deleteSid: (id: number) => apiRequest<void>("delete", `${API_BASE}/sids/${id}`),

  listObjects: () => apiRequest<AclObjectIdentityDto[]>("get", `${API_BASE}/objects`),
  createObject: (payload: AclObjectIdentityRequest) =>
    apiRequest<AclObjectIdentityDto>("post", `${API_BASE}/objects`, { data: payload }),
  deleteObject: (id: number) => apiRequest<void>("delete", `${API_BASE}/objects/${id}`),

  listEntries: () => apiRequest<AclEntryDto[]>("get", `${API_BASE}/entries`),
  createEntry: (payload: AclEntryRequest) =>
    apiRequest<AclEntryDto>("post", `${API_BASE}/entries`, { data: payload }),
  deleteEntry: (id: number) => apiRequest<void>("delete", `${API_BASE}/entries/${id}`),

  listActions: () => apiRequest<AclActionMaskDto[]>("get", `${API_BASE}/actions`),
};
