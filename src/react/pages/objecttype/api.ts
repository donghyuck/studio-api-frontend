import { apiRequest } from "@/react/query/fetcher";
import type {
  ObjectTypeDto,
  ObjectTypeEffectivePolicyDto,
  ObjectTypePatchRequest,
  ObjectTypePolicyDto,
  ObjectTypePolicyUpsertRequest,
  ObjectTypeUpsertRequest,
} from "@/types/studio/objecttype";

const BASE = "/api/mgmt/object-types";

export const reactObjectTypeApi = {
  list: (params?: { domain?: string; status?: string; q?: string }) =>
    apiRequest<ObjectTypeDto[]>("get", BASE, { params }),

  get: (objectType: number) =>
    apiRequest<ObjectTypeDto>("get", `${BASE}/${objectType}`),

  create: (payload: ObjectTypeUpsertRequest) =>
    apiRequest<ObjectTypeDto, ObjectTypeUpsertRequest>("post", BASE, { data: payload }),

  patch: (objectType: number, payload: ObjectTypePatchRequest) =>
    apiRequest<ObjectTypeDto>("patch", `${BASE}/${objectType}`, { data: payload }),

  delete: (objectType: number) =>
    apiRequest<void>("delete", `${BASE}/${objectType}`),

  getPolicy: (objectType: number) =>
    apiRequest<ObjectTypePolicyDto>("get", `${BASE}/${objectType}/policy`),

  getEffectivePolicy: (objectType: number) =>
    apiRequest<ObjectTypeEffectivePolicyDto>("get", `${BASE}/${objectType}/policy/effective`),

  upsertPolicy: (objectType: number, payload: ObjectTypePolicyUpsertRequest) =>
    apiRequest<ObjectTypePolicyDto>("put", `${BASE}/${objectType}/policy`, { data: payload }),
};
