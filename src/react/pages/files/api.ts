import { apiRequest } from "@/react/query/fetcher";
import { apiClient } from "@/react/api/client";
import type { RagIndexRequestDto } from "@/types/studio/ai";
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
  async getById(attachmentId: number) {
    return apiRequest<AttachmentDto>("get", `/api/mgmt/files/${attachmentId}`);
  },
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
  async extractText(attachmentId: number) {
    return apiRequest<string>("get", `/api/mgmt/files/${attachmentId}/text`);
  },
  async hasEmbedding(attachmentId: number) {
    return apiRequest<boolean>("get", `/api/mgmt/files/${attachmentId}/embedding/exists`);
  },
  async ragIndex(attachmentId: number, options?: Partial<RagIndexRequestDto>): Promise<string | null> {
    const response = await apiClient.post<void>(`/api/mgmt/attachments/${attachmentId}/rag/index`, options ?? {}, {
      withCredentials: true,
    });
    return (
      (response.headers["x-rag-job-id"] as string) ||
      (response.headers["X-RAG-Job-Id"] as string) ||
      null
    );
  },
  async ragMetadata(attachmentId: number) {
    return apiRequest<Record<string, unknown>>(
      "get",
      `/api/mgmt/files/${attachmentId}/rag/metadata`
    );
  },
  async fetchThumbnail(attachmentId: number, size = 256, format = "png") {
    const response = await apiClient.get<Blob>(`/api/mgmt/files/${attachmentId}/thumbnail`, {
      params: { size, format },
      responseType: "blob",
      withCredentials: true,
    });
    return response.data;
  },
};
