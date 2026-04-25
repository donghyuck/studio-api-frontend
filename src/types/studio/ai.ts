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
  [key: string]: unknown;
}

export interface ChatRagRequestDto {
  chat:ChatRequestDto;
  ragQuery?:string;
  ragTopK?: number; // 선택
  objectType?: string;
  objectId?: string;
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
  useLlmKeywordExtraction?: boolean;
}
