export interface WikiPageSummaryDto {
  pageId: number;
  workspaceId: number;
  slug: string;
  title: string;
  currentRevisionId?: number | null;
  revisionNo?: number | null;
  archived?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface WikiPageDto extends WikiPageSummaryDto {
  markdown?: string | null;
  sanitizedHtml?: string | null;
}

export interface WikiRevisionSummaryDto {
  revisionId: number;
  pageId: number;
  workspaceId: number;
  slug: string;
  title: string;
  revisionNo?: number | null;
  createdBy?: number | null;
  createdAt?: string | null;
}

export interface WikiRevisionDto extends WikiRevisionSummaryDto {
  markdown?: string | null;
  sanitizedHtml?: string | null;
}

export interface WikiPageWriteRequest {
  title: string;
  markdown: string;
  baseRevisionId?: number | null;
}

export interface WikiArchiveRequest {
  baseRevisionId?: number | null;
}

export interface WikiRevertRequest {
  baseRevisionId?: number | null;
}
