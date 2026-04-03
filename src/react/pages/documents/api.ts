import { documentApi } from "@/data/studio/mgmt/document";
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

export const reactDocumentsApi = {
  getLatest(documentId: number): Promise<DocumentBundleResponse> {
    return documentApi.getLatest(documentId);
  },
  getVersion(documentId: number, versionId: number): Promise<DocumentBundleResponse> {
    return documentApi.getVersion(documentId, versionId);
  },
  listBlocksTree(documentId: number, params?: DocumentTreeParams): Promise<{ data: DocumentBlockNode[] }> {
    return documentApi.listBlocksTree(documentId, params);
  },
  listBlocksByVersion(
    documentId: number,
    versionId: number,
    params?: { includeDeleted?: boolean; parentBlockId?: number }
  ): Promise<DocumentBlocksResponse> {
    return documentApi.listBlocksByVersion(documentId, versionId, params);
  },
  getBlock(documentId: number, blockId: number): Promise<DocumentBlockResponse> {
    return documentApi.getBlock(documentId, blockId);
  },
  createBlock(documentId: number, payload: DocumentBlockCreateRequest) {
    return documentApi.createBlock(documentId, payload);
  },
  updateBlock(
    documentId: number,
    blockId: number,
    payload: DocumentBlockUpdateRequest,
    ifMatch?: string
  ) {
    return documentApi.updateBlock(documentId, blockId, payload, ifMatch);
  },
  deleteBlock(documentId: number, blockId: number, ifMatch?: string) {
    return documentApi.deleteBlock(documentId, blockId, ifMatch);
  },
};
