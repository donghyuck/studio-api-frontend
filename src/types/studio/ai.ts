export type Role = "system" | "user" | "assistant";

export interface ChatMessageDto {
  messageId?: string;
  role: Role;
  content: string;
  createdAt?: string;
}

export interface ChatRequestDto {
  deploymentId?: string; // 표준 계약: 백엔드 배포 ID (예: "chat-default", "chat-pro", "local-gemma-v1")
  provider?: string; // 선택: 백엔드에서 지원 시
  model?: string; // 예: "gpt-4o-mini" 또는 "gemini-2.5-flash"
  messages: ChatMessageDto[];
  systemPrompt?: string; // 선택
  temperature?: number; // 선택
  topP?: number; // 선택
  topK?: number; // 선택
  maxOutputTokens?: number; // 선택
  stopSequences?: string[]; // 선택
  memory?: ChatMemoryOptionsDto;
}

export interface AiDeploymentDto {
  deploymentId: string;
  model: string;
  provider: string;
  workload?: "CHAT" | "EMBEDDING" | string;
  dimension?: number;
  modality?: string;
  embeddingSpace?: string;
  displayName?: string;
  isDefault?: boolean;
}

export interface AiModelDto {
  modelId: string;
  model: string;
  provider: string;
  workloads?: string[];
  effective?: boolean;
}

export interface ChatMemoryOptionsDto {
  enabled?: boolean;
  conversationId?: string;
}

export interface ChatResponseDto {
  conversationId?: string;
  messages: ChatMessageDto[];
  model?: string;
  metadata?: ChatResponseMetadataDto;
}

export interface ChatResponseMetadataDto {
  provider?: string;
  resolvedModel?: string;
  tokenUsage?: TokenUsageDto;
  latencyMs?: number;
  memoryUsed?: boolean;
  conversationId?: string;
  memoryEnabled?: boolean;
  memoryMessageCount?: number;
  responseId?: string;
  finishReason?: string;
  ragReferences?: RagReferenceDto[];
  canonicalContent?: string;
  answerPolicy?: ResolvedRagAnswerPolicyDto;
  sourcePolicy?: ResolvedRagSourcePolicyDto;
  externalRetrieval?: ResolvedRagExternalRetrievalDto;
  externalSourceReview?: ExternalSourceReviewDto;
  answerPolicyValidationStatus?: string;
  ragAnswerOutcome?: RagAnswerOutcomeDto;
  answerPresentation?: ResolvedRagAnswerPresentationDto;
  answerBlocks?: RagAnswerBlocksDto;
  [key: string]: unknown;
}

export interface ResolvedRagAnswerPresentationDto {
  requestedPreference?: RagAnswerPresentationPreference | null;
  effectivePreference: RagAnswerPresentationPreference;
  source: "SERVER_DEFAULT" | "REQUEST";
  clamped: boolean;
  reasonCode: string;
  policyVersion: string;
  generationStrategy: "MARKDOWN" | string;
  allowedBlockTypes: string[];
  selectedBlockTypes: string[];
}

export interface RagAnswerBlocksDto {
  schemaVersion: string;
  canonicalContentFingerprint?: string;
  blocks: RagAnswerBlockDto[];
}

export type RagAnswerBlockDto =
  | RagAnswerTableBlockDto
  | RagAnswerChartBlockDto
  | RagAnswerSourceImageBlockDto;

export interface RagAnswerTableBlockDto {
  blockId: string;
  type: "TABLE";
  columns: string[];
  rows: Array<{ cells: string[]; citationIndexes: number[] }>;
}

export interface RagAnswerChartBlockDto {
  blockId: string;
  type: "CHART";
  chartType: "BAR";
  title: string;
  unit: string;
  points: Array<{ label: string; value: number; citationIndexes: number[] }>;
}

export interface RagAnswerSourceImageBlockDto {
  blockId: string;
  type: "SOURCE_IMAGE";
  mediaType: "image/png";
  src: string;
  alt: string;
  page: number;
  citationIndexes: number[];
}

export type RagAnswerMode = "STRICT_GROUNDED" | "GROUNDED_INFERENCE";

export interface ResolvedRagAnswerPolicyDto {
  requestedMode?: RagAnswerMode | null;
  effectiveMode: RagAnswerMode;
  source: "SERVER_DEFAULT" | "REQUEST";
  clamped: boolean;
  reasonCode: "NONE" | "SERVER_MAXIMUM" | "CLIENT_SELECTION_DISABLED" | string;
  policyVersion: string;
}

export interface RagAnswerPolicyCapabilitiesDto {
  defaultMode: RagAnswerMode;
  maximumMode: RagAnswerMode;
  clientSelectionEnabled: boolean;
  policyVersion: string;
  availableModes: RagAnswerMode[];
}

export type RagSourceScope = "DOCUMENT_ONLY" | "DOCUMENT_AND_OFFICIAL_EXTERNAL";

export interface ResolvedRagSourcePolicyDto {
  requestedScope?: RagSourceScope | null;
  effectiveScope: RagSourceScope;
  source: "SERVER_DEFAULT" | "REQUEST";
  clamped: boolean;
  reasonCode:
    | "NONE"
    | "SERVER_MAXIMUM"
    | "CLIENT_SELECTION_DISABLED"
    | "EXTERNAL_PROVIDER_UNAVAILABLE"
    | string;
  policyVersion: string;
}

export interface RagSourcePolicyCapabilitiesDto {
  defaultScope: RagSourceScope;
  maximumScope: RagSourceScope;
  clientSelectionEnabled: boolean;
  externalProviderAvailable: boolean;
  policyVersion: string;
  availableScopes: RagSourceScope[];
}

export type RagExternalRetrievalMode = "OFF" | "AUTO";

export interface ResolvedRagExternalRetrievalDto {
  requestedMode?: RagExternalRetrievalMode | null;
  effectiveMode: RagExternalRetrievalMode;
  source: "SERVER_DEFAULT" | "REQUEST";
  clamped: boolean;
  reasonCode: string;
  policyVersion: string;
  searched: boolean;
  decisionReasonCode: string;
  internalEvidenceCount: number;
  status: string;
  retrievalReasonCode: string;
  evidenceCount: number;
}

export interface RagExternalRetrievalCapabilitiesDto {
  defaultMode: RagExternalRetrievalMode;
  maximumMode: RagExternalRetrievalMode;
  clientSelectionEnabled: boolean;
  policyVersion: string;
  availableModes: RagExternalRetrievalMode[];
}

export type RagAnswerPresentationPreference =
  | "AUTO"
  | "TEXT_FOCUSED"
  | "VISUAL_PREFERRED";

export interface RagAnswerPresentationRequestDto {
  preference: RagAnswerPresentationPreference;
}

export interface RagAnswerPresentationCapabilitiesDto {
  enabled: boolean;
  defaultPreference: RagAnswerPresentationPreference;
  clientSelectionEnabled: boolean;
  policyVersion: string;
  availablePreferences: RagAnswerPresentationPreference[];
  allowedBlockTypes: string[];
}

export interface RagChatCapabilitiesDto {
  answerPolicy: RagAnswerPolicyCapabilitiesDto;
  sourcePolicy: RagSourcePolicyCapabilitiesDto;
  indexedWeb: IndexedWebCapabilitiesDto;
  answerPresentation: RagAnswerPresentationCapabilitiesDto;
  externalRetrieval?: RagExternalRetrievalCapabilitiesDto;
}

export interface IndexedWebCapabilitiesDto {
  enabled: boolean;
  maxSelectedSources: number;
  supportedSchemes: string[];
  maxUrlLength: number;
  collectionModes?: string[];
  siteCrawlEnabled?: boolean;
  defaultMaxDepth?: number;
  maximumDepth?: number;
  defaultMaxPages?: number;
  maximumPages?: number;
  defaultMaxConcurrency?: number;
  maximumConcurrency?: number;
  discoveryModes?: string[];
}

export interface IndexedWebSourceRefDto {
  sourceId: string;
  revisionId?: string;
  corpusRevisionId?: string;
}

export type WebCollectionMode = "SINGLE_PAGE" | "SITE" | string;
export type WebCrawlScope = "PATH_PREFIX" | "SAME_ORIGIN" | string;
export type WebCrawlDiscoveryMode = "SITEMAP_AND_LINKS" | "SITEMAP_ONLY" | "LINKS_ONLY" | string;

export interface WebCrawlPolicyRequest {
  scope?: WebCrawlScope;
  discoveryMode?: WebCrawlDiscoveryMode;
  maxDepth?: number;
  maxPages?: number;
  maxConcurrency?: number;
  includePathGlobs?: string[];
  excludePathGlobs?: string[];
  allowedQueryKeys?: string[];
}

export interface WebKnowledgeSourceDto {
  sourceId: string;
  workspaceId: number;
  url: string;
  canonicalUrl?: string | null;
  host: string;
  displayName?: string | null;
  embeddingDeploymentId: string;
  embeddingSpaceId?: string | null;
  status: "PENDING" | "FETCHING" | "NORMALIZING" | "INDEXING" | "COMPLETED" | "UNCHANGED" | "FAILED" | "CANCELLED" | string;
  collectionMode?: WebCollectionMode;
  currentRevisionId?: string | null;
  currentCorpusRevisionId?: string | null;
  revisionStatus?: string | null;
  latestRunId?: string | null;
  crawlTruncated?: boolean;
  discoveredCount?: number;
  fetchedCount?: number;
  indexedCount?: number;
  unchangedCount?: number;
  updatedCount?: number;
  removedCount?: number;
  failedCount?: number;
  skippedCount?: number;
  title?: string | null;
  publisher?: string | null;
  language?: string | null;
  publishedAt?: string | null;
  modifiedAt?: string | null;
  retrievedAt?: string | null;
  contentPreview?: string | null;
  errorCode?: string | null;
  crawlPolicy?: WebKnowledgeSitePreviewEffectivePolicy | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebKnowledgeSourceCreateRequest {
  url: string;
  displayName?: string;
  embeddingDeploymentId: string;
  collectionMode?: WebCollectionMode;
  crawlPolicy?: WebCrawlPolicyRequest;
}

export interface WebKnowledgeSitePreviewRequest {
  url: string;
  crawlPolicy?: WebCrawlPolicyRequest;
}

export interface WebKnowledgeSitePreviewCandidate {
  url: string;
  host: string;
  path: string;
  depth: number;
  discoveredBy?: string;
}

export interface WebKnowledgeSitePreviewExcludedCandidate {
  host: string;
  path: string;
  reasonCode: string;
}

export interface WebKnowledgeSitePreviewEffectivePolicy {
  scope: string;
  discoveryMode: string;
  maxDepth: number;
  maxPages: number;
  maxConcurrency: number;
  minDelayPerOriginMillis: number;
  dropAllQuery: boolean;
  includePathGlobs: string[];
  excludePathGlobs: string[];
  allowedQueryKeys: string[];
  policyVersion?: string;
}

export interface WebKnowledgeSitePreviewView {
  rootUrl: string;
  effectivePolicy: WebKnowledgeSitePreviewEffectivePolicy;
  candidateCount: number;
  candidates: WebKnowledgeSitePreviewCandidate[];
  excludedCount: number;
  excludedSamples: WebKnowledgeSitePreviewExcludedCandidate[];
  queryParametersRemovedCount: number;
  truncated: boolean;
  warnings: string[];
}

export interface WebKnowledgeCrawlRunView {
  runId: string;
  status: string;
  discoveredCount: number;
  fetchedCount: number;
  indexedCount: number;
  unchangedCount: number;
  updatedCount: number;
  removedCount: number;
  failedCount: number;
  skippedCount: number;
  responseBytes: number;
  normalizedChars: number;
  truncated: boolean;
  truncationReason?: string | null;
  errorCode?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebKnowledgePageView {
  url: string;
  canonicalUrl?: string | null;
  host?: string | null;
  path?: string | null;
  title?: string | null;
  status: string;
  active: boolean;
  missingRunCount: number;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  updatedAt?: string | null;
}

export interface ExternalSourceReviewDto {
  status: "NOT_REQUESTED" | "COMPLETE" | "NO_RESULTS" | "UNAVAILABLE" | "FAILED" | string;
  reasonCode: string;
  evidenceCount: number;
}

export interface RagReferenceDto {
  index?: number;
  citationIndex?: number;
  evidenceId?: string;
  usageStatus?: "CITED" | "RETRIEVED_ONLY";
  locator?: string;
  documentId?: string;
  revisionId?: string;
  sourceName?: string;
  originalFileName?: string;
  title?: string;
  documentSemanticType?: string;
  chunkId?: string;
  chunkOrder?: number | string;
  score?: number;
  excerpt?: string;
  exactText?: string;
  content?: string;
  page?: number | string;
  pageNumber?: number | string;
  slide?: number | string;
  slideNumber?: number | string;
  sourceRef?: string;
  sourceRefs?: string;
  section?: string;
  heading?: string;
  evidenceKind?: string;
  supportStatus?: "SOURCE_VERIFIED" | "INFERRED" | "INDEX_VALID" | string;
  origin?: "DOCUMENT" | "INDEXED_WEB" | "OFFICIAL_EXTERNAL";
  sourceType?: "NORMALIZED_CHUNK" | "STATUTE" | "CASE" | "GOVERNMENT" | "ACADEMIC" | "OFFICIAL" | string;
  publisher?: string;
  canonicalUrl?: string;
  publishedDate?: string;
  effectiveDate?: string;
  retrievedAt?: string;
  startOffset?: number;
  endOffset?: number;
  truncated?: boolean;
  blockIds?: string[];
  spanChunkId?: string;
  spans?: Array<{
    exactText: string;
    chunkId?: string;
    sourceRef?: string;
    page?: number;
    slide?: number;
    section?: string;
    startOffset?: number;
    endOffset?: number;
    truncated?: boolean;
    blockIds?: string[];
  }>;
  metadata?: Record<string, unknown>;
}

export type RagAnswerOutcomeType = "ANSWERED" | "EVIDENCE_ONLY" | "ABSTAINED";
export type RagAnswerOutcomeStage = "NONE" | "RETRIEVAL" | "PACKING" | "VALIDATION" | "GENERATION";
export type RagAnswerOutcomeReasonCode =
  | "NONE"
  | "NO_RETRIEVAL_RESULTS"
  | "NO_PACKED_EVIDENCE"
  | "EMPTY_DRAFT"
  | "MISSING_CITATION"
  | "OUT_OF_RANGE_CITATION"
  | "MISSING_UNIT_CITATION"
  | "MISSING_COMPARISON_SOURCE_CITATION"
  | "INSUFFICIENT_SOURCE_COVERAGE"
  | "NO_USABLE_SOURCE_SPAN";

export interface RagAnswerOutcomeDto {
  type: RagAnswerOutcomeType;
  stage: RagAnswerOutcomeStage;
  reasonCode: RagAnswerOutcomeReasonCode;
  retrievedResultCount: number;
  acceptedResultCount: number;
  packedEvidenceCount: number;
  usedEvidenceIndexes: number[];
  citationValidationStatus: string;
  policyValidationStatus: string;
  validationUnitCount: number;
  citedValidationUnitCount: number;
  partial?: boolean;
  originalValidationUnitCount?: number;
  omittedValidationUnitCount?: number;
}

export interface ChatRagRequestDto {
  chat: ChatRequestDto;
  ragQuery?: string;
  ragTopK?: number; // 선택
  objectType?: string;
  objectId?: string;
  embeddingProfileId?: string;
  embeddingProvider?: string;
  embeddingModel?: string;
  embeddingDeploymentId?: string;
  topK?: number;
  minScore?: number;
  debug?: boolean;
  retrievalStrategy?: string;
  retrievalOptions?: {
    structureTopK?: number;
    ideaBlockTopK?: number;
    finalTopK?: number;
    minScore?: number;
    dedupe?: boolean;
    includeDebugChunks?: boolean;
  };
  answerMode?: RagAnswerMode;
  sourceScope?: RagSourceScope;
  externalRetrievalMode?: RagExternalRetrievalMode;
  externalSourceOptions?: {
    jurisdiction?: string;
    asOfDate?: string;
    language?: string;
  };
  indexedWebSources?: IndexedWebSourceRefDto[];
  presentation?: RagAnswerPresentationRequestDto;
}

export interface TokenUsageDto {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// ai-info.types.ts

export interface ProviderChannel {
  readonly enabled: boolean;
  readonly model: string;
}

export interface ProviderInfo {
  readonly name: string;
  readonly chat: ProviderChannel;
  readonly embedding: ProviderChannel;
  readonly baseUrl: string;
}

export interface VectorInfo {
  readonly available: boolean;
  readonly implementation: string;
}

export interface AiInfoResponse {
  readonly providers: ProviderInfo[];
  readonly defaultProvider: string;
  readonly vector: VectorInfo;
  readonly chat?: ChatInfo;
}

export interface ChatInfo {
  readonly memory?: ChatMemoryInfo;
}

export interface ChatMemoryInfo {
  readonly enabled: boolean;
  readonly maxMessages?: number;
  readonly maxConversations?: number;
  readonly ttl?: string;
}

export interface ChatStreamDeltaEventDto {
  delta?: string;
  content?: string;
}

export interface ChatStreamUsageEventDto extends Partial<TokenUsageDto> {
  type?: string;
  requestId?: string;
  metadata?: ChatResponseMetadataDto;
}

export interface ChatStreamCompleteEventDto {
  type?: string;
  requestId?: string;
  model?: string;
  provider?: string;
  resolvedModel?: string;
  conversationId?: string;
  latencyMs?: number;
  fallbackUsed?: boolean;
  finishReason?: string;
  metadata?: ChatResponseMetadataDto;
}

export interface ChatStreamErrorEventDto {
  type?: string;
  requestId?: string;
  errorMessage?: string;
  metadata?: ChatResponseMetadataDto;
}

export interface RagStreamStatusEventDto {
  type?: string;
  requestId?: string;
  stage?: "retrieval_started" | "retrieval_complete" | string;
  retrievalMs?: number;
  resultCount?: number;
}

export interface ConversationSummaryDto {
  conversationId: string;
  title?: string;
  summary?: string;
  messageCount?: number;
  lastUpdatedAt?: string;
}

export interface ConversationDetailDto extends ConversationSummaryDto {
  messages: ChatMessageDto[];
}

export interface ConversationDeleteResponseDto {
  conversationId: string;
  deleted: boolean;
}

export interface RegenerateRequestDto {
  conversationId: string;
}

export interface RagRegenerateRequestDto {
  conversationId: string;
  rag: ChatRagRequestDto;
}

export interface AclActionMaskDto {
  readonly action: string;
  readonly mask: number;
}

export interface SearchRequestDto {
  query?: string | null;
  topK?: number;
  hybrid?:boolean
  objectType?: string;
  objectId?: string;
  minScore?: number;
  embeddingProfileId?: string;
  embeddingProvider?: string;
  embeddingModel?: string;
}

export interface SearchResultDto {
  documentId: string;
  content: string;
  metadata?: Record<string, unknown>;
  score?: number;
}


export interface SearchResponseDto {
  results : SearchResultDto[]
}

export interface VectorSearchRequestDto extends SearchRequestDto {
  embedding?: number[];
  objectType?: string;
  objectId?: string;
  minScore?: number;
}

export interface VectorProjectionSummaryDto {
  projectionId: string;
  name: string;
  algorithm: string;
  status: string;
  targetTypes: string[];
  itemCount: number;
  createdAt?: string;
  completedAt?: string;
  mode?: 'OVERVIEW' | 'DETAIL' | null;
  totalCount?: number | null;
  projectedCount?: number | null;
  sampled?: boolean | null;
  sampleSize?: number | null;
  samplingStrategy?: string | null;
  maxAllowed?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface VectorProjectionListResponseDto {
  items: VectorProjectionSummaryDto[];
}

export interface VectorProjectionCreateRequestDto {
  name: string;
  targetTypes?: string[] | null;
  algorithm?: string;
  filters?: Record<string, unknown> | null;
  mode?: 'OVERVIEW' | 'DETAIL';
  sampleSize?: number | null;
  samplingStrategy?: 'HEAD' | 'RANDOM' | 'STRATIFIED' | null;
}

export interface VectorProjectionCreateResponseDto {
  projectionId: string;
  status: string;
  message: string;
}

export interface VectorProjectionDetailDto {
  projectionId: string;
  name: string;
  algorithm: string;
  status: string;
  targetTypes: string[];
  filters: Record<string, unknown> | null;
  itemCount: number;
  errorMessage?: string | null;
  createdAt?: string;
  completedAt?: string;
  mode?: 'OVERVIEW' | 'DETAIL' | null;
  totalCount?: number | null;
  projectedCount?: number | null;
  sampled?: boolean | null;
  sampleSize?: number | null;
  samplingStrategy?: string | null;
  maxAllowed?: number | null;
  errorCode?: string | null;
}

export interface VectorProjectionEstimateRequest {
  mode: 'OVERVIEW' | 'DETAIL';
  targetTypes?: string[] | null;
  filters?: Record<string, unknown> | null;
  sampleSize?: number | null;
  samplingStrategy?: 'HEAD' | 'RANDOM' | 'STRATIFIED' | null;
}

export interface VectorProjectionEstimateResponse {
  success: boolean;
  data: {
    totalCount: number;
    maxAllowed: number;
    exceedsLimit: boolean;
    recommendedSampling: {
      sampleSize: number;
      samplingStrategy: 'HEAD' | 'RANDOM' | 'STRATIFIED';
    } | null;
  };
}

export interface VectorProjectionPointDto {
  vectorItemId: string;
  targetType: string;
  sourceId: string;
  label: string;
  x: number;
  y: number;
  clusterId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface VectorProjectionPointsResponseDto {
  projectionId: string;
  algorithm: string;
  totalCount: number;
  items: VectorProjectionPointDto[];
}

export interface VectorSearchVisualizationQueryPointDto {
  label?: string | null;
  x?: number | null;
  y?: number | null;
}

export interface VectorSearchVisualizationResultPointDto {
  vectorItemId: string;
  targetType?: string;
  sourceId?: string;
  label?: string;
  x: number;
  y: number;
  similarity?: number | null;
  tokenCount?: number | null;
  contextIncluded?: boolean | null;
  metadata?: Record<string, unknown> | null;
}

export interface VectorSearchVisualizationResponseDto {
  query: VectorSearchVisualizationQueryPointDto;
  results: VectorSearchVisualizationResultPointDto[];
}

export interface VectorSearchVisualizationRequestDto {
  projectionId: string;
  query: string;
  targetTypes?: string[] | null;
  embeddingProvider?: string;
  embeddingModel?: string;
  topK?: number;
  minScore?: number;
}

export interface VectorItemDetailDto {
  vectorItemId: string;
  targetType: string;
  sourceId: string;
  label: string;
  text: string;
  embeddingModel?: string | null;
  dimension?: number | null;
  tokenCount?: number | null;
  contextIncluded?: boolean | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
}

export interface VectorDocumentDto {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
  embedding: number[];
}

export interface VectorSearchResultDto extends VectorDocumentDto {
  score?: number;
}

export interface QueryRewriteRequestDto  {
  query : string;
}

export interface QueryRewriteResponseDto {
  originalQuery: string;
  expandedQuery: string;
  keywords: string[]; 
  prompt: string; 
  rawResponse: string;
}

export type ProjectionStatus =
  | "REQUESTED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "DELETED";

export type VectorTargetType =
  | "NCS_UNIT"
  | "COURSE"
  | "COURSE_CHUNK"
  | "DOCUMENT"
  | "DOCUMENT_CHUNK"
  | "QUERY"
  | string;

export interface VectorProjection {
  projectionId: string;
  name: string;
  algorithm: string;
  status: ProjectionStatus;
  targetTypes?: VectorTargetType[];
  filters?: Record<string, unknown>;
  itemCount: number;
  errorMessage?: string | null;
  createdAt?: string;
  completedAt?: string | null;
}

export interface ProjectionListResponse {
  items: VectorProjection[];
}

export interface ProjectionCreateRequest {
  name: string;
  targetTypes?: VectorTargetType[];
  algorithm?: string;
  filters?: Record<string, unknown>;
}

export interface ProjectionCreateResponse {
  projectionId: string;
  status: ProjectionStatus;
  message?: string;
}

export interface ProjectionPoint {
  vectorItemId: string;
  targetType: VectorTargetType;
  sourceId?: string | null;
  label?: string | null;
  x: number;
  y: number;
  clusterId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ProjectionPointsResponse {
  projectionId: string;
  algorithm: string;
  totalCount: number;
  items: ProjectionPoint[];
}

export interface VectorItemDetail {
  vectorItemId: string;
  targetType: VectorTargetType;
  sourceId?: string | null;
  label?: string | null;
  text?: string | null;
  embeddingModel?: string | null;
  dimension?: number | null;
  metadata?: Record<string, unknown>;
  createdAt?: string | null;
}

export interface SearchVisualizationRequest {
  projectionId: string;
  query: string;
  targetTypes?: VectorTargetType[];
  topK?: number;
  minScore?: number;
}

export interface SearchResultPoint {
  vectorItemId: string;
  targetType: VectorTargetType;
  sourceId?: string | null;
  label?: string | null;
  x: number;
  y: number;
  similarity?: number | null;
}

export interface SearchVisualizationResponse {
  query: {
    label?: string | null;
    x?: number | null;
    y?: number | null;
  };
  results: SearchResultPoint[];
}


export interface RagIndexRequestDto {
  documentId?: string;
  objectType?: string;
  objectId?: string;
  metadata?: Record<string, any>;
  keywords?: string[];
  embeddingDeploymentId?: string;
  embeddingProfileId?: string;
  embeddingProvider?: string;
  embeddingModel?: string;
  useLlmKeywordExtraction?: boolean;
  chunkingStrategy?: string;
}

export type RagIndexJobStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "WARNING"
  | "FAILED"
  | "CANCELLED";

export type RagIndexJobStep =
  | "EXTRACTING"
  | "CHUNKING"
  | "EMBEDDING"
  | "INDEXING"
  | "COMPLETED";

export type RagIndexJobLogLevel = "INFO" | "WARN" | "ERROR";

export interface RagIndexJobCreateRequestDto extends RagIndexRequestDto {
  text?: string;
  sourceType?: string;
  forceReindex?: boolean;
  chunkMaxSize?: number;
  chunkOverlap?: number;
  chunkUnit?: string;
}

export interface RagIndexJobDto {
  jobId: string;
  objectType: string;
  objectId: string;
  documentId?: string;
  sourceType?: string;
  sourceName?: string;
  status: RagIndexJobStatus;
  currentStep?: RagIndexJobStep;
  chunkCount: number;
  embeddedCount: number;
  indexedCount: number;
  warningCount: number;
  errorMessage?: string;
  chunkingStrategy?: string;
  chunkMaxSize?: number;
  chunkOverlap?: number;
  chunkUnit?: string;
  createdAt?: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  embeddingProfileId?: string;
  embeddingProvider?: string;
  embeddingModel?: string;
  embeddingDeploymentId?: string;
  catalogId?: string;
  embeddingSpaceId?: string;
}
export type RagIndexJobListResponseDto = PageDto<RagIndexJobDto>;

export interface RagIndexJobLogDto {
  logId: string;
  jobId: string;
  level: RagIndexJobLogLevel;
  step?: RagIndexJobStep;
  code?: string;
  message?: string;
  detail?: string;
  createdAt?: string;
}

export interface RagIndexChunkDto {
  chunkId: string;
  documentId: string;
  parentChunkId?: string;
  chunkOrder?: number;
  chunkIndex?: number;
  chunkType?: string;
  content: string;
  textLength?: number;
  tokenCount?: number;
  tokenizerProvider?: string;
  tokenizerEncoding?: string;
  embeddingProvider?: string;
  embeddingModel?: string;
  warningStatus?: string;
  warnings?: string[];
  score?: number;
  headingPath?: string;
  section?: string;
  sourceRef?: string;
  page?: number;
  slide?: number;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  indexedAt?: string;
}

export interface PageDto<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
  sort?: string;
}

export type RagIndexChunkPageResponseDto = PageDto<RagIndexChunkDto>;


export interface RagChunkPreviewRequestDto {
  text: string;
  documentId?: string;
  objectType?: string;
  objectId?: string;
  contentType?: string;
  filename?: string;
  strategy?: string;
  maxSize?: number;
  overlap?: number;
  unit?: string;
  metadata?: Record<string, unknown>;
}

export interface RagChunkPreviewItemDto {
  chunkId: string;
  content: string;
  contentLength: number;
  chunkOrder?: number;
  chunkIndex?: number;
  chunkType?: string;
  textLength?: number;
  tokenCount?: number;
  tokenizerProvider?: string;
  tokenizerEncoding?: string;
  embeddingProvider?: string;
  embeddingModel?: string;
  warningStatus?: string;
  warnings?: string[];
  parentChunkId?: string;
  previousChunkId?: string;
  nextChunkId?: string;
  headingPath?: string;
  section?: string;
  sourceRef?: string;
  page?: number;
  slide?: number;
  metadata?: Record<string, unknown>;
}

export interface RagChunkPreviewResponseDto {
  chunks: RagChunkPreviewItemDto[];
  totalChunks: number;
  totalChars: number;
  strategy: string;
  maxSize: number;
  overlap: number;
  unit: string;
  warnings: string[];
}

export interface RagChunkConfigResponseDto {
  chunking: {
    available: boolean;
    enabled: boolean;
    strategy: string;
    previewStrategy?: string | null;
    defaultStrategyPreviewSupported: boolean;
    maxSize: number;
    overlap: number;
    availableStrategies: string[];
    registeredChunkers: string[];
    chunkingOrchestratorAvailable: boolean;
  };
  legacyFallback: {
    chunkSize: number;
    chunkOverlap: number;
    textChunkerAvailable: boolean;
  };
  ragContext: {
    maxChunks: number;
    maxChars: number;
    includeScores: boolean;
    expansion: {
      enabled: boolean;
      candidateMultiplier: number;
      maxCandidates: number;
      previousWindow: number;
      nextWindow: number;
      includeParentContent: boolean;
    };
  };
  limits: {
    enabled: boolean;
    maxInputChars: number;
    maxPreviewChunks: number;
  };
}

export interface RagTokenizerStatusDto {
  embeddingProvider?: string | null;
  embeddingModel?: string | null;
  tokenizerProvider?: string | null;
  tokenizerEncoding?: string | null;
  tokenizerModel?: string | null;
  selectionSource?: string | null;
  confidence?: number | string | null;
  chunkUnit?: string | null;
  chunkSize?: number | null;
  chunkOverlap?: number | null;
  fallbackUsed?: boolean | null;
  warnings?: string[];
}

export interface RagChunkingSimulationRequestDto {
  text: string;
  objectType?: string;
  objectId?: string;
  attachmentId?: string;
  embeddingProvider?: string;
  embeddingModel?: string;
  tokenizerAutoDetect?: boolean;
  chunkUnit?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  maxChunkSize?: number;
}

export interface RagChunkingSimulationResponseDto {
  tokenizer?: RagTokenizerStatusDto | null;
  chunks?: RagChunkPreviewItemDto[];
  tokenDistribution?: number[];
  totalChunks?: number;
  totalChars?: number;
  totalTokens?: number;
  warnings?: string[];
}

export interface RagContextSimulationRequestDto {
  query: string;
  objectType?: string;
  objectId?: string;
  topK?: number;
  contextBudgetTokens?: number;
  includeNeighborChunks?: boolean;
  includeParentChunk?: boolean;
  embeddingProvider?: string;
  embeddingModel?: string;
  minScore?: number;
}

export interface RagContextSimulationChunkDto extends SearchResultDto {
  rank?: number;
  chunkId?: string;
  chunkIndex?: number;
  objectType?: string;
  objectId?: string;
  tokenCount?: number;
  included?: boolean;
  exclusionReason?: string;
  cumulativeTokenCount?: number;
  tokenizerProvider?: string;
  tokenizerEncoding?: string;
  embeddingModel?: string;
  warnings?: string[];
}

export interface RagContextSimulationResponseDto {
  tokenizer?: RagTokenizerStatusDto | null;
  chunks?: RagContextSimulationChunkDto[];
  retrievedChunks?: RagContextSimulationChunkDto[];
  usedTokens?: number;
  budgetTokens?: number;
  contextBudgetTokens?: number;
  finalContext?: string;
  warnings?: string[];
}
