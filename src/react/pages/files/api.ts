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

export interface ThumbnailResponse {
  blob: Blob;
  status?: string;
  retryAfterMs?: number;
}

export interface AttachmentDownloadUrlIssueRequest {
  ttlSeconds?: number | null;
}

export interface AttachmentDownloadUrlDto {
  url: string;
  expiresAt: string;
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
  async issueDownloadUrl(attachmentId: number, request?: AttachmentDownloadUrlIssueRequest) {
    return apiRequest<AttachmentDownloadUrlDto>(
      "post",
      `/api/mgmt/attachments/${attachmentId}/download-url`,
      { data: request ?? {} }
    );
  },
  async extractText(attachmentId: number) {
    return apiRequest<string>("get", `/api/mgmt/files/${attachmentId}/text`);
  },
  async hasEmbedding(attachmentId: number) {
    return apiRequest<boolean>("get", `/api/mgmt/files/${attachmentId}/embedding/exists`);
  },
  async ragIndex(attachmentId: number, options?: Partial<RagIndexRequestDto>) {
    await apiRequest("post", `/api/mgmt/files/${attachmentId}/rag/index`, {
      data: options ?? {},
    });
  },
  async ragMetadata(attachmentId: number) {
    return apiRequest<Record<string, unknown>>(
      "get",
      `/api/mgmt/files/${attachmentId}/rag/metadata`
    );
  },
  async fetchThumbnail(attachmentId: number, size = 256, format = "png"): Promise<ThumbnailResponse> {
    const response = await apiClient.get<Blob>(`/api/attachments/${attachmentId}/thumbnail`, {
      params: { size, format },
      responseType: "blob",
      withCredentials: true,
    });
    const retryAfter = Number(response.headers["retry-after"]);
    return {
      blob: response.data,
      status: response.headers["x-thumbnail-status"],
      retryAfterMs: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined,
    };
  },
  async downloadBlob(attachmentId: number) {
    const response = await apiClient.get<Blob>(`/api/attachments/${attachmentId}/download`, {
      responseType: "blob",
      withCredentials: true,
    });
    return response.data;
  },
};
