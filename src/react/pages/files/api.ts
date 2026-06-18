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
    const response = await apiClient.post<void>(`/api/mgmt/files/${attachmentId}/rag/index`, options ?? {}, {
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
      `/api/mgmt/ai/rag/objects/attachment/${attachmentId}/metadata`
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

export type DocumentConvertStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELED";

export interface DocumentConvertOptions {
  pdfEngine?: "xelatex";
  mainFont?: string;
  toc?: boolean;
  numberSections?: boolean;
  standalone?: boolean;
  metadata?: {
    title?: string;
    author?: string;
  };
}

export interface DocumentConvertRequest {
  sourceFileId: string;
  sourceFormat: "markdown" | "html" | "docx" | "pdf";
  targetFormat: "markdown" | "html" | "docx" | "pdf";
  options?: DocumentConvertOptions;
}

export interface DocumentConvertJob {
  jobId: string;
  status: DocumentConvertStatus;
  sourceFileId: string;
  sourceFormat: string;
  targetFormat: string;
  resultFileId: string | null;
  downloadUrl: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
}

export const reactDocumentConvertApi = {
  async convert(request: DocumentConvertRequest): Promise<DocumentConvertJob> {
    return apiRequest<DocumentConvertJob>("post", "/api/document-conversions", {
      data: request,
    });
  },
  async getJob(jobId: string): Promise<DocumentConvertJob> {
    return apiRequest<DocumentConvertJob>("get", `/api/document-conversions/${encodeURIComponent(jobId)}`);
  },
  async retryJob(jobId: string): Promise<DocumentConvertJob> {
    return apiRequest<DocumentConvertJob>("post", `/api/document-conversions/${encodeURIComponent(jobId)}/retry`);
  },
  async cancelJob(jobId: string): Promise<void> {
    await apiRequest("delete", `/api/document-conversions/${encodeURIComponent(jobId)}`);
  },
};

export type MarkdownDocumentRevisionStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELED";

export interface MarkdownDocumentDto {
  documentId: string;
  sourceAttachmentId: number;
  currentRevisionId: string;
}

export interface MarkdownDocumentRevisionDto {
  revisionId: string;
  documentId: string;
  resultAttachmentId: number | null;
  documentConvertJobId: string | null;
  status: MarkdownDocumentRevisionStatus;
  markdownText: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  extractorType?: string;
  extractorVersion?: string;
  optionsJson?: string;
  createdAt: string;
  completedAt?: string;
  completedPartCount?: number;
  totalPartCount?: number;
  failedPartCount?: number;
  emptyPartCount?: number;
  pageFrom?: number;
  pageTo?: number;
  lastCompletedPage?: number;
}

export interface MarkdownLocatorDto {
  locatorId: string;
  documentId: string;
  revisionId: string;
  title: string;
  level: number;
  startOffset: number;
  endOffset: number;
  pageNumber: number | null;
  orderIndex: number;
}

export interface MarkdownResourceDto {
  resourceId: string;
  documentId: string;
  revisionId: string;
  name: string;
  attachmentId: number;
  contentType: string;
  sizeBytes: number;
  resourceType: string;
}

export interface MarkdownDocumentFromAttachmentResponse {
  document: MarkdownDocumentDto;
  revision: MarkdownDocumentRevisionDto;
  reused: boolean;
}

export interface MarkdownDocumentFromAttachmentRequest {
  attachmentId: number;
  runChunking: boolean;
  runRagIndex: boolean;
  runSkillExtraction: boolean;
  force: boolean;
  chunkingStrategy?: string | null;
  chunkMaxSize?: number | null;
  chunkOverlap?: number | null;
  chunkUnit?: string | null;
  embeddingProfileId?: string | null;
  embeddingProvider?: string | null;
  embeddingModel?: string | null;
  embeddingDimension?: number | null;
  skillExtractionMode?: 'regex' | 'llm' | null;
}

export interface MarkdownDocumentReextractRequest {
  runChunking: boolean;
  runRagIndex: boolean;
  runSkillExtraction: boolean;
  chunkingStrategy?: string | null;
  chunkMaxSize?: number | null;
  chunkOverlap?: number | null;
  chunkUnit?: string | null;
  embeddingProfileId?: string | null;
  embeddingProvider?: string | null;
  embeddingModel?: string | null;
  embeddingDimension?: number | null;
  skillExtractionMode?: 'regex' | 'llm' | null;
}

export type MarkdownPipelineExecutionStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "UNKNOWN";

export type MarkdownPipelineStage =
  | "CHUNKING"
  | "RAG_INDEX"
  | "SKILL_EXTRACTION"
  | "COMPLETED";

export interface MarkdownPipelineExecutionDto {
  revisionId: string;
  status: MarkdownPipelineExecutionStatus;
  currentStage: MarkdownPipelineStage;
  lastCompletedStage: MarkdownPipelineStage | null;
  attemptCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
}

export interface MarkdownResumeRequest {
  fromStage?: MarkdownPipelineStage | null;
  runChunking?: boolean;
  runRagIndex?: boolean;
  runSkillExtraction?: boolean;
  chunkingStrategy?: string;
  chunkMaxSize?: number;
  chunkOverlap?: number;
  chunkUnit?: string;
  embeddingProfileId?: string;
  embeddingProvider?: string | null;
  embeddingModel?: string | null;
  embeddingDimension?: number | null;
  skillExtractionMode?: 'regex' | 'llm' | null;
}

export interface MarkdownResumeResultDto {
  document: MarkdownDocumentDto;
  revision: MarkdownDocumentRevisionDto;
  pipeline: MarkdownPipelineExecutionDto;
  resumedPhase: string;
  resumedFrom: MarkdownPipelineStage;
}

export interface MarkdownRagReindexRequest {
  embeddingProfileId?: string | null;
  embeddingProvider?: string | null;
  embeddingModel?: string | null;
  embeddingDimension?: number | null;
  runSkillExtraction: boolean;
  skillExtractionMode?: 'regex' | 'llm' | null;
}

export const reactMarkdownDocumentApi = {
  async extractFromAttachment(request: MarkdownDocumentFromAttachmentRequest): Promise<MarkdownDocumentFromAttachmentResponse> {
    return apiRequest<MarkdownDocumentFromAttachmentResponse>("post", "/api/markdown-documents/from-attachment", {
      data: request,
    });
  },
  async getDocument(documentId: string): Promise<MarkdownDocumentDto> {
    return apiRequest<MarkdownDocumentDto>("get", `/api/markdown-documents/${encodeURIComponent(documentId)}`);
  },
  async getByAttachment(attachmentId: number): Promise<MarkdownDocumentDto> {
    return apiRequest<MarkdownDocumentDto>("get", `/api/markdown-documents/by-attachment/${attachmentId}`);
  },
  async getRevisions(documentId: string, options?: { signal?: AbortSignal }): Promise<MarkdownDocumentRevisionDto[]> {
    return apiRequest<MarkdownDocumentRevisionDto[]>("get", `/api/markdown-documents/${encodeURIComponent(documentId)}/revisions`, options);
  },
  async getPipeline(documentId: string): Promise<MarkdownPipelineExecutionDto> {
    return apiRequest<MarkdownPipelineExecutionDto>("get", `/api/markdown-documents/${encodeURIComponent(documentId)}/pipeline`);
  },
  async reextract(documentId: string, request: MarkdownDocumentReextractRequest): Promise<MarkdownDocumentFromAttachmentResponse> {
    return apiRequest<MarkdownDocumentFromAttachmentResponse>("post", `/api/markdown-documents/${encodeURIComponent(documentId)}/reextract`, {
      data: request,
    });
  },
  async resume(documentId: string, request?: MarkdownResumeRequest): Promise<MarkdownResumeResultDto> {
    return apiRequest<MarkdownResumeResultDto>("post", `/api/markdown-documents/${encodeURIComponent(documentId)}/resume`, {
      data: request || {},
    });
  },
  async reindexRag(documentId: string, request: MarkdownRagReindexRequest): Promise<MarkdownResumeResultDto> {
    return apiRequest<MarkdownResumeResultDto>("post", `/api/markdown-documents/${encodeURIComponent(documentId)}/rag/reindex`, {
      data: request,
    });
  },
  async cancelExtraction(documentId: string): Promise<void> {
    await apiRequest("delete", `/api/markdown-documents/${encodeURIComponent(documentId)}/extraction`);
  },
  async getLocators(documentId: string): Promise<MarkdownLocatorDto[]> {
    return apiRequest<MarkdownLocatorDto[]>("get", `/api/markdown-documents/${encodeURIComponent(documentId)}/locators`);
  },
  async getResources(documentId: string): Promise<MarkdownResourceDto[]> {
    return apiRequest<MarkdownResourceDto[]>("get", `/api/markdown-documents/${encodeURIComponent(documentId)}/resources`);
  },
};
