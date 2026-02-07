import { api } from "@/data/http";
import type {
  ObjectTypeDefinitionDto,
  ValidateUploadRequest,
  ValidateUploadResponse,
} from "@/types/studio/objecttype";

const BASE = "/api/object-types";

/**
 * Public helpers for querying runtime metadata about object types.
 *
 * ## Usage
 *
 * 1. Call `definition(objectType)` to fetch the server-side definition (type + policy)
 *    before rendering object-specific upload forms or metadata pages.
 * 2. Pre-validate uploads by calling `validateUpload(objectType, payload)` before actually
 *    sending the file; the response says whether the file satisfies policy and why it was rejected.
 * 3. Both helpers return wrapped `ApiResponse<T>` payloads via `api.get`/`api.post`, so handle
 *    `data` and `etag` exactly like other `data/http` helpers (e.g., `forumsPublicApi`).
 */
export const objectTypePublicApi = {
  definition(objectType: number) {
    return api.get<ObjectTypeDefinitionDto>(`${BASE}/${objectType}/definition`);
  },
  validateUpload(objectType: number, payload: ValidateUploadRequest) {
    return api.post<ValidateUploadResponse>(`${BASE}/${objectType}/validate-upload`, payload);
  },
};
