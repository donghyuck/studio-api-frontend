import { apiRequest } from "@/react/query/fetcher";
import type { AttachmentDto } from "@/types/studio/files";

export interface PaginatedFilesResponse {
  content: AttachmentDto[];
  totalElements: number;
}

export interface FileListParams {
  page: number;
  size: number;
  keyword?: string;
  objectType?: number;
  objectId?: number;
}

export const reactFilesApi = {
  async list(params: FileListParams) {
    return apiRequest<PaginatedFilesResponse>("get", "/api/mgmt/files", {
      params,
    });
  },
  async upload(file: File, objectType: number | null, objectId: number | null) {
    const formData = new FormData();
    formData.append("file", file);
    if (objectType != null) {
      formData.append("objectType", String(objectType));
    }
    if (objectId != null) {
      formData.append("objectId", String(objectId));
    }

    await apiRequest("post", "/api/mgmt/files", {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      data: formData,
    });
  },
  async deleteById(attachmentId: number) {
    await apiRequest("delete", `/api/mgmt/files/${attachmentId}`);
  },
};
