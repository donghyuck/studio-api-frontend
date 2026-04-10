import { apiRequest } from "@/react/query/fetcher";

export type PropertyOwnerType = "users" | "groups";

export interface PropertyEntryDto {
  key: string;
  value: string;
}

export function getProperties(type: PropertyOwnerType, id: number) {
  return apiRequest<Record<string, string>>("get", `/api/mgmt/${type}/${id}/properties`);
}

export function replaceProperties(
  type: PropertyOwnerType,
  id: number,
  properties: Record<string, string>
) {
  return apiRequest<Record<string, string>, Record<string, string>>(
    "put",
    `/api/mgmt/${type}/${id}/properties`,
    { data: properties }
  );
}

export function setProperty(
  type: PropertyOwnerType,
  id: number,
  key: string,
  value: string
) {
  return apiRequest<PropertyEntryDto, PropertyEntryDto>(
    "put",
    `/api/mgmt/${type}/${id}/properties/${encodeURIComponent(key)}`,
    { data: { key, value } }
  );
}

export function deleteProperty(type: PropertyOwnerType, id: number, key: string) {
  return apiRequest<void>("delete", `/api/mgmt/${type}/${id}/properties/${encodeURIComponent(key)}`);
}
