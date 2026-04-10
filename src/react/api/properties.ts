import { apiRequest } from "@/react/query/fetcher";

export type PropertyOwnerType = "users" | "groups";

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
