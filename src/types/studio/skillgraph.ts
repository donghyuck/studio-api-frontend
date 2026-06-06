export type SkillGraphRole =
  | "ROLE_SKILLGRAPH_VIEWER"
  | "ROLE_SKILLGRAPH_OPERATOR"
  | "ROLE_SKILLGRAPH_REVIEWER"
  | "ROLE_SKILLGRAPH_ADMIN"
  | "ROLE_ADMIN"
  | "ROLE_DEVELOPER";

export type SkillCandidateStatus =
  | "PENDING"
  | "MATCHED"
  | "ALIAS_CANDIDATE"
  | "NEW_SKILL_CANDIDATE"
  | "APPROVED"
  | "REJECTED"
  | "NOISE";

export type SkillGraphJobStatus =
  | "CREATED"
  | "VALIDATING"
  | "READY"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "PARTIAL"
  | "CANCELED"
  | "CANCELLED";

export type SkillRelationType =
  | "RELATED"
  | "PREREQUISITE"
  | "ALTERNATIVE"
  | "USED_WITH"
  | "PART_OF";

export type SkillCategoryRelationType =
  | "PARENT"
  | "RELATED"
  | "OVERLAPS_WITH"
  | "PREREQUISITE"
  | "MERGE_CANDIDATE"
  | "PARENT_CANDIDATE";

export interface SkillGraphDashboard {
  totalSkillCount: number;
  candidateCount: number;
  pendingReviewCount: number;
  aliasCandidateCount: number;
  noiseCount: number;
  clusterCount: number;
  recentSkills?: SkillDictionaryItem[];
  categoryDistribution?: SkillCategoryMetric[];
  recentJobs?: SkillGraphJob[];
}

export interface SkillCategoryMetric {
  categoryId?: number;
  categoryName: string;
  skillCount: number;
}

export interface SkillGraphJob {
  jobId: number | string;
  objectType?: string;
  objectId?: string;
  documentId?: string;
  status: SkillGraphJobStatus;
  currentStep?: string;
  totalCount?: number;
  processedCount?: number;
  requestedChunks?: number;
  totalChunks?: number;
  processedChunks?: number;
  succeededChunks?: number;
  failedCount?: number;
  failedChunks?: number;
  extractedCount?: number;
  error?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt?: string;
  startedAt?: string;
  completedAt?: string;
  generateEmbeddings?: boolean;
  embeddingProvider?: string;
  embeddingModel?: string;
  embeddingDimension?: number;
  embeddingJobId?: string;
  embeddingStatus?: string;
  chunkingStrategy?: string;
  mode?: string;
  q?: string;
  chunkIds?: string[];
  excludeExtracted?: boolean;
}

export interface SkillCandidate {
  candidateId: number | string;
  sourceChunkId?: string;
  sourceType?: string;
  sourceId?: string;
  rawText: string;
  normalizedText: string;
  term?: string;
  normalizedTerm?: string;
  searchText?: string;
  skillType?: string;
  action?: string;
  technology?: string[];
  target?: string;
  evidenceText?: string;
  context?: string;
  difficulty?: string;
  extractionMethod?: string;
  confidenceDetail?: string;
  sourcePosition?: string;
  normalizationInfo?: string;
  mappingCandidates?: string;
  reviewStatus?: string;
  feedback?: string;
  embedded?: boolean;
  embeddingProvider?: string;
  embeddingModel?: string;
  embeddingDimension?: number;
  embeddings?: SkillEmbeddingMetadata[];
  evidenceSentence?: string;
  candidateType?: string;
  matchedSkillId?: number | string;
  matchedSkillName?: string;
  matchedSkill?: {
    skillId?: number | string;
    skillName?: string;
    name?: string;
    similarityScore?: number;
  };
  similarityScore?: number;
  clusterId?: number;
  status: SkillCandidateStatus;
  occurrenceCount: number;
  confidence?: number;
  confidenceScore?: number;
  createdAt: string;
  updatedAt?: string;
  reviewedAt?: string;
  reviewerNote?: string;
}

export interface SkillCandidateAutoApproveSkip {
  candidateId: string;
  reason: string;
  confidence?: number;
  similarityScore?: number;
}

export interface SkillCandidateAutoApproveResult {
  requestedCount: number;
  approvedCount: number;
  skippedCount: number;
  approved: SkillCandidate[];
  skipped: SkillCandidateAutoApproveSkip[];
}

export type SkillRecommendationJobStatus =
  | "CREATED"
  | "VALIDATING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED";

export type SkillRecommendationResultStatus =
  | "CANDIDATE"
  | "APPLIED"
  | "IGNORED"
  | "FAILED"
  | "SKIPPED";

export type SkillRecommendationType =
  | "EXISTING_SKILL_MATCH"
  | "DUPLICATE_CANDIDATE"
  | "SIMILAR_CANDIDATE"
  | "NCS_MAPPING_CANDIDATE"
  | "NEW_SKILL_CANDIDATE"
  | "REVIEW_REQUIRED"
  | "LOW_CONFIDENCE";

export interface SkillRecommendationJob {
  jobId: string;
  targetScope: string;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimension: number;
  targetTypes?: string;
  topK: number;
  minScore: number;
  newSkillMinConfidence: number;
  existingSkillMinScore: number;
  status: SkillRecommendationJobStatus;
  totalCount: number;
  processedCount: number;
  resultCount: number;
  failedCount: number;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt?: string;
}

export interface SkillRecommendationResult {
  resultId: string;
  jobId: string;
  sourceId: string;
  sourceText?: string;
  targetSourceType?: string;
  targetSourceId?: string;
  targetText?: string;
  recommendationType: SkillRecommendationType;
  similarityScore: number;
  confidence: number;
  reason?: string;
  status: SkillRecommendationResultStatus;
  applyType?: string;
  bulkApplicable: boolean;
  appliedAt?: string;
  appliedBy?: string;
  createdAt: string;
}

export interface SkillRecommendationApplyResult {
  requestedCount: number;
  appliedCount: number;
  skippedCount: number;
  failedCount: number;
  skipped: Array<{ resultId: string; candidateId: string; reason: string }>;
  failed: Array<{ resultId: string; candidateId: string; reason: string }>;
}

export interface SkillDictionaryItem {
  skillId: number | string;
  name?: string;
  skillName: string;
  normalizedName: string;
  description?: string;
  skillType?: string;
  categoryId?: number | string;
  categoryName?: string;
  sourceCount?: number;
  confidenceScore?: number;
  approved?: boolean;
  active?: boolean;
  embedded?: boolean;
  embeddingProvider?: string;
  embeddingModel?: string;
  embeddingDimension?: number;
  embeddings?: SkillEmbeddingMetadata[];
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  aliases?: SkillAlias[];
  relations?: SkillRelation[];
}

export interface SkillEmbeddingMetadata {
  embeddingProvider?: string;
  embeddingModel?: string;
  embeddingDimension?: number;
  createdAt?: string;
}

export interface SkillAlias {
  aliasId?: number;
  alias: string;
  normalizedAlias?: string;
  source?: string;
}

export interface SkillCategory {
  categoryId: number | string;
  parentId?: number | string;
  parentCategoryId?: number | string;
  name?: string;
  categoryName: string;
  description?: string;
  depth: number;
  sortOrder: number;
  displayOrder?: number;
  active: boolean;
  skillCount: number;
  children?: SkillCategory[];
}

export interface SkillClusterPoint {
  targetType: "CANDIDATE" | "SKILL";
  targetId: number | string;
  skillId?: string;
  label: string;
  x: number;
  y: number;
  z?: number;
  clusterId?: number | string;
  clusterLabel?: string;
  status?: string;
  score?: number;
}

export interface SkillRelation {
  relationId: number;
  fromSkillId: number;
  fromSkillName: string;
  toSkillId: number;
  toSkillName: string;
  relationType: SkillRelationType;
  confidenceScore?: number;
  source?: string;
}

export interface SkillCategoryRelation {
  relationId?: string;
  sourceCategoryId: string | number;
  targetCategoryId: string | number;
  relationType: SkillCategoryRelationType;
  score: number;
  confidence: number;
  reason?: string;
  persisted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SkillCategoryParentSuggestion {
  suggestionId: string;
  suggestedName: string;
  childCategoryIds: Array<string | number>;
  relationCount: number;
  score: number;
  confidence?: number;
  reason?: string;
}

export interface SkillCategoryGraph {
  categories: SkillCategory[];
  skills: SkillDictionaryItem[];
  relations: SkillCategoryRelation[];
  parentSuggestions?: SkillCategoryParentSuggestion[];
}

export interface SkillMapping {
  mappingId: number;
  skillId: number;
  skillName: string;
  targetId: number | string;
  targetName: string;
  targetType?: string;
  similarityScore?: number;
  confidenceScore?: number;
  approved?: boolean;
  evidence?: string;
  weight?: number;
  role?: "CORE" | "SUPPORTING";
}

export interface SkillGraphPageResponse<T> {
  content?: T[];
  items?: T[];
  results?: T[];
  totalElements?: number;
  total?: number;
  offset?: number;
  limit?: number;
  returned?: number;
  hasMore?: boolean;
}

export interface SkillRagChunkPreview {
  chunkId: string;
  documentId?: string;
  objectId?: string;
  chunkOrder?: number;
  page?: number;
  section?: string;
  textPreview?: string;
  tokenCount?: number;
  textLength: number;
  warningStatus?: string;
}

export interface RagDocumentExtractionRequest {
  objectType: string;
  objectId?: string | null;
  documentId?: string | null;
  mode: string;
  limit?: number;
  q?: string | null;
  excludeExtracted: boolean;
  generateEmbeddings: boolean;
  embeddingProvider?: string | null;
  embeddingModel?: string | null;
  embeddingDimension?: number | null;
}


export interface SkillRagChunkPageResponse {
  content: SkillRagChunkPreview[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  numberOfElements: number;
  empty: boolean;
  sort?: any;
}

export type SkillRagExtractionMode = "ALL_CHUNKS" | "SELECTED_CHUNKS";

export interface SkillRagExtractionRequest {
  objectType: string;
  objectId?: string | null;
  documentId?: string;
  mode?: SkillRagExtractionMode;
  chunkIds?: string[];
  limit?: number;
  q?: string | null;
  excludeExtracted?: boolean;
  generateEmbeddings?: boolean;
  embeddingProvider?: string | null;
  embeddingModel?: string | null;
  embeddingDimension?: number | null;
}

export interface SkillRagExtractionJobResponse {
  jobId: number | string;
  status: string;
}

export interface SkillRagChunkExtractionItem {
  chunkId: string;
  documentId?: string;
  sourceId?: string;
  sourceChunkId?: string;
  extractedCount: number;
  status: "SUCCEEDED" | "FAILED" | "NOT_FOUND" | string;
  error?: string;
}

export interface SkillRagBatchExtractionResponse {
  objectType: string;
  objectId: string;
  documentId?: string;
  requestedChunks: number;
  resolvedChunks: number;
  succeededChunks: number;
  failedChunks: number;
  extractedCount: number;
  items: SkillRagChunkExtractionItem[];
}

export interface SkillRagExtractionJobItem {
  jobId: string;
  chunkId: string;
  documentId?: string;
  sourceId?: string;
  sourceChunkId?: string;
  extractedCount: number;
  status: string;
  error?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SkillRagExtractionJobItemPageResponse {
  jobId: string;
  offset: number;
  limit: number;
  returned: number;
  hasMore: boolean;
  items: SkillRagExtractionJobItem[];
}

export interface SkillGraphListParams {
  keyword?: string;
  status?: string;
  objectType?: string;
  objectId?: string;
  categoryId?: number | string;
  parentCategoryId?: number | string;
  skillType?: string;
  active?: boolean | "";
  minScore?: number | string;
  maxScore?: number | string;
  minOccurrence?: number | string;
  limit?: number;
  offset?: number;
  page?: number;
  size?: number;
  sort?: string | string[];
}

export interface SkillGraphSimulationRequest {
  text?: string;
  query?: string;
  targetType?: string;
  topK?: number;
  minScore?: number;
  algorithm?: string;
  params?: Record<string, unknown>;
}

export interface SkillGraphSimulationResponse {
  chunks?: string[];
  candidates?: SkillCandidate[];
  matches?: SkillDictionaryItem[];
  points?: SkillClusterPoint[];
  relations?: SkillRelation[];
  mappings?: SkillMapping[];
  summary?: Record<string, unknown>;
}
