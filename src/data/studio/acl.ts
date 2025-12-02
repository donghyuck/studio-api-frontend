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
import { api } from "@/utils/http";

const API_BASE = "/api/security/acl/admin";

export async function createAclClass(
  payload: AclClassRequest
): Promise<AclClassDto> {
  const created = await api.post<AclClassDto>(`${API_BASE}/classes`, payload);
  return created;
}

export async function deleteAclClass(id: number) {
  await api.delete(`${API_BASE}/classes/${id}`);
}

export async function deleteAclClasss(ids: number[]) {
  await api.delete(`${API_BASE}/classes`, ids);
}

export async function createAclSid(payload: AclSidRequest) : Promise<AclSidDto>  {
  const created = await api.post<AclSidDto>(`${API_BASE}/sids`, payload);
  return created;
}

export async function deleteAclSid(id: number) {
  await api.delete(`${API_BASE}/sids/${id}`);
}

export async function createObjectIdentity(payload: AclObjectIdentityRequest) : Promise<AclObjectIdentityDto>  {
  const created = await api.post<AclObjectIdentityDto>(
    `${API_BASE}/objects`,
    payload
  );
  return created;
}

export async function deleteObjectIdentity(id: number) {
  await api.delete(`${API_BASE}/objects/${id}`);
}

export async function createAclEntry(payload: AclEntryRequest):Promise<AclEntryDto> {
  const created = await api.post<AclEntryDto>(`${API_BASE}/entries`, payload);
  return created;
}

export async function deleteAclEntry(id: number) {
  await api.delete(`${API_BASE}/entries/${id}`);
}


export async function fetchActions(): Promise<AclActionMaskDto[]> {
  const payload = await api.get<AclActionMaskDto[]>(`${API_BASE}/actions`);
  return payload;
}