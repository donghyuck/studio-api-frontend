export type Role = "system" | "user" | "assistant";

export interface ChatMessageDto {
  messageId?: string;
  role: Role;
  content: string;
  createdAt?: string;
}

export interface ChatRequestDto {
  provider?: string; // 선택: 백엔드에서 지원 시
  model?: string; // 예: "gpt-4o-mini" 또는 "gemini-2.0-flash"
  messages: ChatMessageDto[];
  systemPrompt?: string; // 선택
  temperature?: number; // 선택
  topP?: number; // 선택
  topK?: number; // 선택
  maxOutputTokens?: number; // 선택
  stopSequences?: string[]; // 선택
  memory?: ChatMemoryOptionsDto;
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
  [key: string]: unknown;
}

export interface RagReferenceDto {
  index?: number;
  documentId?: string;
  sourceName?: string;
  chunkId?: string;
  chunkOrder?: number | string;
  score?: number;
  content?: string;
  page?: number | string;
  pageNumber?: number | string;
  slide?: number | string;
  slideNumber?: number | string;
  sourceRef?: string;
  sourceRefs?: string;
  section?: string;
  heading?: string;
  metadata?: Record<string, unknown>;
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
  topK?: number;
  minScore?: number;
  debug?: boolean;
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
}

export interface VectorProjectionListResponseDto {
  items: VectorProjectionSummaryDto[];
}

export interface VectorProjectionCreateRequestDto {
  name: string;
  targetTypes?: string[] | null;
  algorithm?: string;
  filters?: Record<string, unknown> | null;
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


export interface RagIndexRequestDto {
  documentId?: string;
  objectType?: string;
  objectId?: string;
  metadata?: Record<string, any>;
  keywords?: string[];
  embeddingProfileId?: string;
  embeddingProvider?: string;
  embeddingModel?: string;
  useLlmKeywordExtraction?: boolean;
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
  chunkingStrategy?: string;
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
}

export interface RagIndexJobListResponseDto {
  items: RagIndexJobDto[];
  total: number;
  offset: number;
  limit: number;
}

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

export interface RagIndexChunkPageResponseDto {
  items: RagIndexChunkDto[];
  offset: number;
  limit: number;
  returned: number;
  hasMore: boolean;
}

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
