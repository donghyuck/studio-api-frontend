import { apiClient } from "@/react/api/client";
import { apiRequest } from "@/react/query/fetcher";
import type {
  DocumentBlock,
  DocumentBlockCreateRequest,
  DocumentBlockNode,
  DocumentBlockUpdateRequest,
  DocumentVersionBundle,
} from "@/types/studio/document";

export interface DocumentBundleResponse {
  data: DocumentVersionBundle;
  etag?: string;
}

export interface DocumentBlocksResponse {
  data: DocumentBlock[];
  etag?: string;
}

export interface DocumentBlockResponse {
  data: DocumentBlock;
  etag?: string;
}

export interface DocumentTreeParams {
  versionId?: number;
  includeDeleted?: boolean;
}

interface ApiEnvelope<T> {
  data?: T;
}

const API_BASE = "/api/mgmt/documents";

function unwrapPayload<T>(payload: ApiEnvelope<T> | T) {
  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    "data" in payload
  ) {
    return payload.data as T;
  }

  return payload as T;
}

async function requestWithMeta<T>(url: string, params?: Record<string, unknown>) {
  const response = await apiClient.get<ApiEnvelope<T> | T>(url, {
    params,
    withCredentials: true,
  });

  return {
    data: unwrapPayload(response.data),
    etag: response.headers?.etag as string | undefined,
  };
}

export const reactDocumentsApi = {
  getLatest(documentId: number): Promise<DocumentBundleResponse> {
    return requestWithMeta<DocumentVersionBundle>(`${API_BASE}/${documentId}`);
  },
  getVersion(documentId: number, versionId: number): Promise<DocumentBundleResponse> {
    return requestWithMeta<DocumentVersionBundle>(
      `${API_BASE}/${documentId}/versions/${versionId}`
    );
  },
  listBlocksTree(documentId: number, params?: DocumentTreeParams): Promise<{ data: DocumentBlockNode[] }> {
    return apiRequest<DocumentBlockNode[]>(
      "get",
      `${API_BASE}/${documentId}/blocks/tree`,
      { params }
    ).then((data) => ({ data }));
  },
  listBlocksByVersion(
    documentId: number,
    versionId: number,
    params?: { includeDeleted?: boolean; parentBlockId?: number }
  ): Promise<DocumentBlocksResponse> {
    return requestWithMeta<DocumentBlock[]>(
      `${API_BASE}/${documentId}/versions/${versionId}/blocks`,
      params
    );
  },
  getBlock(documentId: number, blockId: number): Promise<DocumentBlockResponse> {
    return requestWithMeta<DocumentBlock>(
      `${API_BASE}/${documentId}/blocks/${blockId}`
    );
  },
  createBlock(documentId: number, payload: DocumentBlockCreateRequest) {
    return apiRequest<{ blockId: number }, DocumentBlockCreateRequest>(
      "post",
      `${API_BASE}/${documentId}/blocks`,
      { data: payload }
    );
  },
  updateBlock(
    documentId: number,
    blockId: number,
    payload: DocumentBlockUpdateRequest,
    ifMatch?: string
  ) {
    return apiRequest<void, DocumentBlockUpdateRequest>(
      "put",
      `${API_BASE}/${documentId}/blocks/${blockId}`,
      {
        data: payload,
        headers: ifMatch ? { "If-Match": ifMatch } : {},
      }
    );
  },
  deleteBlock(documentId: number, blockId: number, ifMatch?: string) {
    return apiRequest<void>("delete", `${API_BASE}/${documentId}/blocks/${blockId}`, {
      headers: ifMatch ? { "If-Match": ifMatch } : {},
    });
  },
};
