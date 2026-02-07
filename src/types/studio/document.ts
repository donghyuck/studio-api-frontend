import type { IsoOffsetDateTime } from "@/types/studio/api-common";

export interface Document {
  documentId: number;
  objectType: number;
  objectId: number;
  name: string;
  pattern?: string | null;
  createdAt?: IsoOffsetDateTime | null;
  updatedAt?: IsoOffsetDateTime | null;
}

export interface DocumentSummaryDto {
  documentId: number;
  objectType: number;
  objectId: number;
  parentDocumentId?: number | null;
  sortOrder?: number | null;
  name: string;
  title?: string | null;
  latestVersionId?: number | null;
  createdBy: number;
  updatedBy?: number | null;
  createdAt?: IsoOffsetDateTime | null;
  updatedAt?: IsoOffsetDateTime | null;
}

export interface DocumentCreateRequest {
  objectType: number;
  objectId: number;
  parentDocumentId?: number | null;
  sortOrder?: number | null;
  name: string;
  title: string;
  bodyType: number;
  bodyText: string;
  properties?: Record<string, string> | null;
}

export interface DocumentCreateResponse {
  documentId: number;
  versionId: number;
}

export interface DocumentVersion {
  versionId: number;
  title: string;
  bodyType: number;
  bodyText: string;
  createdAt?: IsoOffsetDateTime | null;
  updatedAt?: IsoOffsetDateTime | null;
}

export interface DocumentVersionBundle {
  document: Document;
  version: DocumentVersion;
  // 필요시: properties, blocks summary 등 백엔드 모델에 맞춰 확장
}

export interface DocumentBlock {
  blockId: number;
  documentId: number;
  parentBlockId?: number | null;
  blockType: string;
  blockData?: string | null;
  sortOrder?: number | null;
  createdAt?: IsoOffsetDateTime | null;
  updatedAt?: IsoOffsetDateTime | null;
  // deletedAt 같은 필드가 있다면 추가
}

export interface DocumentBlockNode {
  block: DocumentBlock;
  children: DocumentBlockNode[];
}
