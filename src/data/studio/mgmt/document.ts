import type {
  DocumentBlock,
  DocumentBlockNode,
  DocumentCreateRequest,
  DocumentCreateResponse,
  DocumentVersionBundle,
} from "@/types/studio/document";
import { api } from "@/data/http";

export const API_BASE = "/api/mgmt/documents";

export const documentApi = {
  async createDocument(payload: DocumentCreateRequest) {
    return api.post<DocumentCreateResponse>(API_BASE, payload);
  },
  async getLatest(documentId: number) {
    const res = await api.getWithMeta<DocumentVersionBundle>(
      `${API_BASE}/${documentId}`
    );
    return {
      data: res.data,
      etag: res.headers?.["etag"] as string | undefined,
    };
  },

  async getVersion(documentId: number, versionId: number) {
    const res = await api.getWithMeta<DocumentVersionBundle>(
      `${API_BASE}/${documentId}/versions/${versionId}`
    );
    return {
      data: res.data,
      etag: res.headers?.["etag"] as string | undefined,
    };
  },

  async updateMeta(
    documentId: number,
    payload: { name: string; pattern?: string | null },
    ifMatch?: string
  ) {
    await api.put<void>(`${API_BASE}/${documentId}/meta`, payload, {
      headers: ifMatch ? { "If-Match": ifMatch } : {},
    });
  },

  async listBlocksTree(
    documentId: number,
    params?: { versionId?: number; includeDeleted?: boolean }
  ) {
    const data = await api.get<DocumentBlockNode[]>(
      `${API_BASE}/${documentId}/blocks/tree`,
      { params }
    );
    return { data };
  },

  async listBlocksByVersion(
    documentId: number,
    versionId: number,
    params?: { includeDeleted?: boolean; parentBlockId?: number }
  ) {
    const res = await api.getWithMeta<DocumentBlock[]>(
      `${API_BASE}/${documentId}/versions/${versionId}/blocks`,
      { params }
    );
    return {
      data: res.data,
      etag: res.headers?.["etag"] as string | undefined,
    };
  },

  async createBlock(documentId: number, payload: any) {
    return api.post<{ blockId: number }>(
      `${API_BASE}/${documentId}/blocks`,
      payload
    );
  },

  async updateBlock(
    documentId: number,
    blockId: number,
    payload: any,
    ifMatch?: string
  ) {
    await api.put<void>(`${API_BASE}/${documentId}/blocks/${blockId}`, payload, {
      headers: ifMatch ? { "If-Match": ifMatch } : {},
    });
  },

  async moveBlock(
    documentId: number,
    blockId: number,
    payload: any,
    ifMatch?: string
  ) {
    await api.patch<void>(
      `${API_BASE}/${documentId}/blocks/${blockId}/move`,
      payload,
      {
        headers: ifMatch ? { "If-Match": ifMatch } : {},
      }
    );
  },

  async deleteBlock(documentId: number, blockId: number, ifMatch?: string) {
    await api.delete<void>(
      `${API_BASE}/${documentId}/blocks/${blockId}`,
      undefined,
      { headers: ifMatch ? { "If-Match": ifMatch } : {} }
    );
  },

  async newVersion(documentId: number, payload: any) {
    return api.post<{ documentId: number; versionId: number }>(
      `${API_BASE}/${documentId}/versions`,
      payload
    );
  },

  async deleteDocument(documentId: number, ifMatch?: string) {
    await api.delete<void>(
      `${API_BASE}/${documentId}`,
      undefined,
      { headers: ifMatch ? { "If-Match": ifMatch } : {} }
    );
  },
};
