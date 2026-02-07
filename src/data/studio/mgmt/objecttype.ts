import { api } from "@/data/http";
import type {
  ObjectTypeDto,
  ObjectTypePatchRequest,
  ObjectTypePolicyDto,
  ObjectTypePolicyUpsertRequest,
  ObjectTypeUpsertRequest,
} from "@/types/studio/objecttype";

const BASE = "/api/mgmt/object-types";

/**
 * Management helpers for creating and modifying object types.
 *
 * - Use `list`/`get` for admin listings/details filtered by `domain`, `status`, or a `q` search term.
 * - Call `create` / `upsert` / `patch` to mutate definitions or metadata, and always supply the
 *   authenticated user via `createdBy`/`updatedBy` fields as required by the backend DTOs.
 * - `getPolicy` / `upsertPolicy` expose the stored policy for an object type and allow editing max file,
 *   allowed extensions/MIME, and any policy JSON. `reload` invokes the server-side rebind for runtime
 *   changes.
 */
export const objectTypeAdminApi = {
  list(params?: { domain?: string; status?: string; q?: string }) {
    return api.get<ObjectTypeDto[]>(BASE, { params });
  },
  get(objectType: number) {
    return api.get<ObjectTypeDto>(`${BASE}/${objectType}`);
  },
  create(payload: ObjectTypeUpsertRequest) {
    return api.post<ObjectTypeDto>(BASE, payload);
  },
  upsert(objectType: number, payload: ObjectTypeUpsertRequest) {
    return api.put<ObjectTypeDto>(`${BASE}/${objectType}`, payload);
  },
  patch(objectType: number, payload: ObjectTypePatchRequest) {
    return api.patch<ObjectTypeDto>(`${BASE}/${objectType}`, payload);
  },
  getPolicy(objectType: number) {
    return api.get<ObjectTypePolicyDto>(`${BASE}/${objectType}/policy`);
  },
  upsertPolicy(objectType: number, payload: ObjectTypePolicyUpsertRequest) {
    return api.put<ObjectTypePolicyDto>(`${BASE}/${objectType}/policy`, payload);
  },
  reload() {
    return api.post<void>(`${BASE}/reload`, {});
  },
};
