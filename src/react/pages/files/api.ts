import axios from 'axios';
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
  blockifyLlmProvider?: string | null;
  blockifyLlmModel?: string | null;
  blockifyPiiMaskingEnabled?: boolean | null;
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
  blockifyLlmProvider?: string | null;
  blockifyLlmModel?: string | null;
  blockifyPiiMaskingEnabled?: boolean | null;
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
  blockifyLlmProvider?: string | null;
  blockifyLlmModel?: string | null;
  blockifyPiiMaskingEnabled?: boolean | null;
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


export type MergeCandidateCluster = {
  clusterId: string;
  size: number;
  maxScore?: number;
  chunkIds: string[];
};

export type SampleIdeaBlock = {
  chunkId: string;
  name?: string;
  criticalQuestion?: string;
  trustedAnswer?: string;
  tags?: string[];
  keywords?: string[];
  entityName?: string;
  entityType?: string;
  sourceEvidence?: unknown;
  sourceBlockRange?: unknown;
  sourceSectionId?: string;
  confidence?: number;
  generatorModel?: string;
  promptVersion?: string;
  fingerprint?: string;

  mergeCandidate?: boolean;
  similarityClusterId?: string;
  similarityClusterSize?: number;
  similarityMaxScore?: number;
  mergePolicy?: string;

  embeddingMergeCandidate?: boolean;
  embeddingSimilarityClusterId?: string;
  embeddingSimilarityClusterSize?: number;
  embeddingSimilarityMaxScore?: number;
  embeddingMergePolicy?: string;
  ideaBlockDistillationSourceChunks?: string[];
};

export type IdeaBlockSummaryDto = {
  documentId: string;
  revisionId: string;
  coverage: number;
  chunkCount: number;
  ideaBlockCount: number;
  fallbackCount: number;

  mergeCandidateCount?: number;
  similarityClusterCount?: number;
  mergeCandidateClusters?: MergeCandidateCluster[];

  embeddingMergeCandidateCount?: number;
  embeddingSimilarityClusterCount?: number;
  embeddingSimilarityThreshold?: number;
  embeddingCandidateClusters?: MergeCandidateCluster[];

  fallbackReasonCounts: Record<string, number>;
  missingSourceBlocks: number[];
  rejectedReasons: string[];
  samples: SampleIdeaBlock[];
};

export const reactMarkdownDocumentApi = {

  async getIdeaBlockSummary(documentId: string, revisionId: string): Promise<IdeaBlockSummaryDto> {
    const { data } = await axios.get(`/api/markdown-documents/${encodeURIComponent(documentId)}/revisions/${encodeURIComponent(revisionId)}/ideablocks/summary`);
    return data;
  },

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
  async estimatePipelineByAttachment(attachmentId: number, request: MarkdownPipelineEstimateRequest): Promise<MarkdownPipelineEstimateResponse> {
    return apiRequest<MarkdownPipelineEstimateResponse>("post", `/api/markdown-documents/by-attachment/${attachmentId}/pipeline/estimate`, {
      data: request,
    });
  },
  async getRevisions(documentId: string, options?: { signal?: AbortSignal }): Promise<MarkdownDocumentRevisionDto[]> {
    return apiRequest<MarkdownDocumentRevisionDto[]>("get", `/api/markdown-documents/${encodeURIComponent(documentId)}/revisions`, options);
  },
  async getPipeline(documentId: string): Promise<MarkdownPipelineExecutionDto> {
    return apiRequest<MarkdownPipelineExecutionDto>("get", `/api/markdown-documents/${encodeURIComponent(documentId)}/pipeline`);
  },
  async estimatePipeline(documentId: string, request: MarkdownPipelineEstimateRequest): Promise<MarkdownPipelineEstimateResponse> {
    return apiRequest<MarkdownPipelineEstimateResponse>("post", `/api/markdown-documents/${encodeURIComponent(documentId)}/pipeline/estimate`, {
      data: request,
    });
  },
  async getProgress(documentId: string): Promise<MarkdownPipelineProgressResponseDto> {
    return apiRequest<MarkdownPipelineProgressResponseDto>("get", `/api/markdown-documents/${encodeURIComponent(documentId)}/pipeline/progress`);
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
  async mergePreview(documentId: string, revisionId: string, request: IdeaBlockMergePreviewRequest): Promise<IdeaBlockMergePreviewResponse> {
    return apiRequest<IdeaBlockMergePreviewResponse>("post", `/api/markdown-documents/${encodeURIComponent(documentId)}/revisions/${encodeURIComponent(revisionId)}/ideablocks/merge-preview`, {
      data: request,
    });
  },
  async mergeApply(documentId: string, revisionId: string, request: IdeaBlockMergeApplyRequest): Promise<IdeaBlockMergeApplyResponse> {
    return apiRequest<IdeaBlockMergeApplyResponse>("post", `/api/markdown-documents/${encodeURIComponent(documentId)}/revisions/${encodeURIComponent(revisionId)}/ideablocks/merge-apply`, {
      data: request,
    });
  },
  async mergeUndo(documentId: string, revisionId: string, request: IdeaBlockMergeUndoRequest): Promise<IdeaBlockMergeUndoResponse> {
    return apiRequest<IdeaBlockMergeUndoResponse>("post", `/api/markdown-documents/${encodeURIComponent(documentId)}/revisions/${encodeURIComponent(revisionId)}/ideablocks/merge-undo`, {
      data: request,
    });
  },
  async mergeApplyBatch(documentId: string, revisionId: string, request: IdeaBlockMergeApplyBatchRequest): Promise<IdeaBlockMergeApplyBatchResponse> {
    return apiRequest<IdeaBlockMergeApplyBatchResponse>("post", `/api/markdown-documents/${encodeURIComponent(documentId)}/revisions/${encodeURIComponent(revisionId)}/ideablocks/merge-apply-batch`, {
      data: request,
    });
  },
  async mergeAutoApply(documentId: string, revisionId: string, request: IdeaBlockMergeAutoApplyRequest): Promise<IdeaBlockMergeApplyBatchResponse> {
    return apiRequest<IdeaBlockMergeApplyBatchResponse>("post", `/api/markdown-documents/${encodeURIComponent(documentId)}/revisions/${encodeURIComponent(revisionId)}/ideablocks/merge-auto-apply`, {
      data: request,
    });
  },
  async createEvaluation(request: RagEvaluationRequest): Promise<RagEvaluationRunResponse> {
    return apiRequest<RagEvaluationRunResponse>("post", "/api/ai/chat/rag/evaluations", {
      data: request,
    });
  },
  async getEvaluations(): Promise<RagEvaluationRunResponse[]> {
    return apiRequest<RagEvaluationRunResponse[]>("get", "/api/ai/chat/rag/evaluations");
  },
  async getEvaluationDetail(runId: string): Promise<RagEvaluationDetailResponse> {
    return apiRequest<RagEvaluationDetailResponse>("get", `/api/ai/chat/rag/evaluations/${encodeURIComponent(runId)}`);
  },
  async compareEvaluations(request: RagEvaluationCompareRequest): Promise<RagEvaluationCompareResponse> {
    return apiRequest<RagEvaluationCompareResponse>("post", "/api/ai/chat/rag/evaluations/compare", {
      data: request,
    });
  },
  async createEvaluationJob(request: RagEvaluationRequest): Promise<RagEvaluationJobResponse> {
    return apiRequest<RagEvaluationJobResponse>("post", "/api/ai/chat/rag/evaluations/jobs", {
      data: request,
    });
  },
  async getEvaluationJobStatus(jobId: string): Promise<RagEvaluationJobResponse> {
    return apiRequest<RagEvaluationJobResponse>("get", `/api/ai/chat/rag/evaluations/jobs/${encodeURIComponent(jobId)}`);
  },
  async getQuestionSets(): Promise<RagEvaluationQuestionSetDto[]> {
    return apiRequest<RagEvaluationQuestionSetDto[]>("get", "/api/ai/chat/rag/evaluations/question-sets");
  },
  async getQuestionSetDetail(questionSetId: string): Promise<RagEvaluationQuestionSetDto> {
    return apiRequest<RagEvaluationQuestionSetDto>("get", `/api/ai/chat/rag/evaluations/question-sets/${encodeURIComponent(questionSetId)}`);
  },
  async getEvaluationAnalysis(questionSetId: string): Promise<RagRetrievalEvaluationAnalysis> {
    return apiRequest<RagRetrievalEvaluationAnalysis>("get", `/api/ai/chat/rag/evaluations/question-sets/${encodeURIComponent(questionSetId)}/analysis`);
  },
  async createEvaluationJobFromQuestionSet(
    questionSetId: string,
    request: {
      strategies: string[];
      topK?: number;
      minScore?: number;
      objectType: string;
      objectId: string;
      embeddingProfileId?: string;
      embeddingProvider?: string;
      embeddingModel?: string;
      retrievalOptions?: any;
    }
  ): Promise<RagEvaluationJobResponse> {
    return apiRequest<RagEvaluationJobResponse>("post", `/api/ai/chat/rag/evaluations/question-sets/${encodeURIComponent(questionSetId)}/jobs`, {
      data: request,
    });
  },
};

export interface MarkdownPipelineEstimateRequest {
  runChunking: boolean;
  runRagIndex: boolean;
  runSkillExtraction: boolean;
  chunkingStrategy?: string | null;
  chunkMaxSize?: number | null;
  chunkOverlap?: number | null;
  chunkUnit?: string | null;
  blockifyLlmProvider?: string | null;
  blockifyLlmModel?: string | null;
  blockifyPiiMaskingEnabled?: boolean | null;
  embeddingProfileId?: string | null;
  embeddingProvider?: string | null;
  embeddingModel?: string | null;
  embeddingDimension?: number | null;
}

export interface MarkdownPipelineEstimateResponse {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  recommended: {
    chunkingStrategy?: string;
    chunkMaxSize?: number;
    chunkOverlap?: number;
    chunkUnit?: string;
    embeddingProfileId?: string;
    embeddingProvider?: string;
    embeddingModel?: string;
    embeddingDimension?: number;
  };
  reason?: string | null;
}

export interface MarkdownPipelineProgressResponseDto {
  status: MarkdownPipelineExecutionStatus;
  currentStage: MarkdownPipelineStage;
  errorCode?: string | null;
  errorMessage?: string | null;
  chunking?: {
    chunkCount: number;
    ideaBlockCount: number;
    fallbackCount: number;
    fallbackReasonCounts: Record<string, number>;
    sourceBlockTargetCount: number;
    sourceBlockCoveredCount: number;
    sourceBlockCoverage: number;
    averageConfidence: number;
  } | null;
  rag?: {
    jobId?: string | null;
    status?: string | null;
    currentStep?: 'EMBEDDING' | 'INDEXING' | string;
    embeddedCount?: number;
    indexedCount?: number;
    chunkCount?: number;
    warningCount?: number;
    errorMessage?: string | null;
  } | null;
}

export type IdeaBlockMergePreviewRequest = {
  clusterId: string;
  preferEmbeddingClusters: boolean;
  llmProvider: string;
  llmModel: string;
  maxClusters: number;
};

export type MergePreviewCluster = {
  clusterId: string;
  clusterType: 'lexical' | 'embedding' | string;
  status: string;
  reason: string;
  criticalQuestion?: string;
  trustedAnswer?: string;
  sourceEvidence?: any[];
  sourceBlockRanges?: any[];
  previewText?: string;
  planId: string;
  planFingerprint: string;
  applicable: boolean;
  validationWarnings: string[];
  mergedFromChunkIds: string[];
};

export type IdeaBlockMergePreviewResponse = {
  clusters: MergePreviewCluster[];
};

export type IdeaBlockMergeApplyRequest = {
  clusterId: string;
  preferEmbeddingClusters: boolean;
  llmProvider: string;
  llmModel: string;
  maxClusters: number;
  planFingerprint: string;
  runRagIndex?: boolean;
  runSkillExtraction?: boolean;
  embeddingProfileId?: string;
  useLlmKeywordExtraction?: boolean;
};

export type IdeaBlockMergeApplyResponse = {
  documentId: string;
  revisionId: string;
  planId: string;
  planFingerprint: string;
  mergedChunkId: string;
  mergedFromChunkIds: string[];
  beforeChunkCount: number;
  afterChunkCount: number;
  pipelineResult?: {
    resumedPhase: string;
    resumedFrom: string;
  } | null;
};

export type IdeaBlockMergeUndoRequest = {
  mergedChunkId: string;
  planFingerprint: string;
  runRagIndex?: boolean;
  embeddingProfileId?: string;
};

export type IdeaBlockMergeUndoResponse = {
  documentId: string;
  revisionId: string;
  mergedChunkId: string;
  planFingerprint: string;
  restoredChunkIds: string[];
  beforeChunkCount: number;
  afterChunkCount: number;
  pipelineResult?: {
    resumedPhase: string;
    resumedFrom: string;
  } | null;
};

export type IdeaBlockMergeApplyBatchRequest = {
  items: {
    clusterId: string;
    preferEmbeddingClusters: boolean;
    llmProvider: string;
    llmModel: string;
    maxClusters: number;
    planFingerprint: string;
  }[];
  runRagIndex?: boolean;
  embeddingProfileId?: string;
};

export type IdeaBlockMergeAutoApplyRequest = {
  preferEmbeddingClusters: boolean;
  llmProvider: string;
  llmModel: string;
  maxClusters: number;
  runRagIndex?: boolean;
  embeddingProfileId?: string;
};

export type IdeaBlockMergeApplyBatchResponse = {
  applied: {
    planId: string;
    mergedChunkId: string;
    mergedFromChunkIds: string[];
  }[];
  failed: {
    planFingerprint: string;
    errorMessage: string;
  }[];
  pipelineResult?: {
    resumedPhase: string;
    resumedFrom: string;
  } | null;
};

export type RagEvaluationRequest = {
  strategies: string[];
  objectType: 'attachment' | string;
  objectId: string;
  embeddingProfileId?: string;
  topK?: number;
  minScore?: number;
  retrievalOptions?: {
    structureTopK?: number;
    ideaBlockTopK?: number;
    finalTopK?: number;
    dedupe?: boolean;
    distilledScoreBoost?: number;
  };
  questions: {
    query: string;
    expectedContentContains?: string[];
  }[];
};

export type RagEvaluationRunResponse = {
  runId: string;
  createdAt: string;
  objectType: string;
  objectId: string;
  embeddingProfileId: string;
  topK: number;
  minScore: number;
  strategies: {
    strategy: string;
    questionCount: number;
    hitCount: number;
    hitRate: number;
    mrr: number;
    averageElapsedMs: number;
    questions: {
      query: string;
      hit: boolean;
      firstRank: number | null;
      resultCount: number;
      chunks: {
        chunkId: string;
        text?: string;
        score?: number;
        metadata?: {
          chunkType?: string;
          actualChunkingStrategy?: string;
          sectionTitle?: string;
          markdownDocumentId?: string;
          markdownRevisionId?: string;
          ideaBlockDistilled?: boolean;
          ideaBlockDistillationFingerprint?: string;
        };
      }[];
    }[];
  }[];
};

export type RagEvaluationCompareRequest = {
  beforeRunId: string;
  afterRunId: string;
};

export type RagEvaluationCompareResponse = {
  beforeRunId: string;
  afterRunId: string;
  strategies: {
    strategy: string;
    beforeHitRate?: number;
    hitRateBefore?: number;
    afterHitRate?: number;
    hitRateAfter?: number;
    hitRateDelta: number;
    beforeMrr?: number;
    mrrBefore?: number;
    afterMrr?: number;
    mrrAfter?: number;
    mrrDelta: number;
    beforeAverageElapsedMs?: number;
    averageElapsedMsBefore?: number;
    afterAverageElapsedMs?: number;
    averageElapsedMsAfter?: number;
    averageElapsedMsDelta: number;
  }[];
};

export type RagEvaluationDetailResponse = RagEvaluationRunResponse;

export type RagEvaluationJobResponse = {
  jobId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  totalQuestions: number;
  completedQuestions: number;
  totalStrategies: number;
  completedStrategies: number;
  currentStrategy?: string | null;
  currentQuestion?: string | null;
  runId?: string | null;
  errorMessage?: string | null;
};

// ==========================================
// RAG 검색 운영 정책 (RAG Retrieval Policy)
// ==========================================

export interface RetrievalOptions {
  structureTopK?: number;
  ideaBlockTopK?: number;
  finalTopK?: number;
  minScore?: number;
  dedupe?: boolean;
  distilledScoreBoost?: number;
  queryExpansionEnabled?: boolean;
}

export interface RetrievalPolicyDto {
  objectType: string;
  objectId: string;
  retrievalStrategy: string;
  retrievalOptions?: RetrievalOptions;
  questionSetId?: string;
  evaluationRunId?: string;
  score?: number;
  hitRate?: number;
  mrr?: number;
  averageElapsedMs?: number;
}

export interface RetrievalPolicyUsageDto {
  usageId: string;
  objectType: string;
  objectId: string;
  retrievalStrategy: string;
  questionSetId?: string;
  evaluationRunId?: string;
  topK?: number;
  minScore?: number;
  resultCount?: number;
  skippedChat?: boolean;
  elapsedMs?: number;
  createdAt: string;
}

export interface RetrievalPolicySummaryDto {
  objectType: string;
  objectId: string;
  usageCount: number;
  averageResultCount: number;
  averageElapsedMs: number;
  skippedChatCount: number;
  latestStrategy?: string;
}

export interface ApplyRecommendationRequest {
  questionSetId: string;
  objectType: string;
  objectId: string;
}

export const reactRetrievalPolicyApi = {
  async getList(): Promise<RetrievalPolicyDto[]> {
    return apiRequest<RetrievalPolicyDto[]>("get", "/api/ai/chat/rag/retrieval-policies");
  },
  async getPolicy(objectType: string, objectId: string | number): Promise<RetrievalPolicyDto> {
    return apiRequest<RetrievalPolicyDto>("get", `/api/ai/chat/rag/retrieval-policies/${objectType}/${objectId}`);
  },
  async savePolicy(policy: RetrievalPolicyDto): Promise<RetrievalPolicyDto> {
    return apiRequest<RetrievalPolicyDto>("put", "/api/ai/chat/rag/retrieval-policies", {
      data: policy,
    });
  },
  async applyRecommendation(request: ApplyRecommendationRequest): Promise<void> {
    await apiRequest("post", "/api/ai/chat/rag/retrieval-policies/apply-recommendation", {
      data: request,
    });
  },
  async getUsage(objectType: string, objectId: string | number): Promise<RetrievalPolicyUsageDto[]> {
    return apiRequest<RetrievalPolicyUsageDto[]>("get", `/api/ai/chat/rag/retrieval-policies/${objectType}/${objectId}/usage`);
  },
  async getSummary(objectType: string, objectId: string | number): Promise<RetrievalPolicySummaryDto> {
    return apiRequest<RetrievalPolicySummaryDto>("get", `/api/ai/chat/rag/retrieval-policies/${objectType}/${objectId}/usage/summary`);
  },
};

export interface RagStrategyAnalysis {
  strategy: string;
  runCount: number;
  questionCount: number;
  hitCount: number;
  hitRate: number;
  mrr: number;
  averageElapsedMs: number;
  failedQuestionCount: number;
  minScore?: number;
  runIds?: string[];
}

export interface RagQuestionAnalysis {
  query: string;
  hitStrategies: string[];
  missedStrategies: string[];
  bestStrategy?: string | null;
  bestRank?: number | null;
}

export interface RagRetrievalEvaluationAnalysis {
  questionSetId: string;
  runCount: number;
  questionCount: number;
  strategies: RagStrategyAnalysis[];
  questions: RagQuestionAnalysis[];
}

export interface RagEvaluationQuestionSetDto {
  questionSetId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  questions: {
    query: string;
    expectedContentContains?: string[];
  }[];
}
