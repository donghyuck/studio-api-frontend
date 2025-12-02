export type Role = "system" | "user" | "assistant";

export interface ChatMessageDto {
  role: Role;
  content: string;
}

export interface ChatRequestDto {
  provider?: string; // 선택: 백엔드에서 지원 시
  model?: string; // 예: "gpt-4o-mini" 또는 "gemini-2.0-flash"
  messages: ChatMessageDto[];
  systemPrompt?: string; // 선택
  temperature?: number; // 선택
  topP?: number; // 선택
  maxOutputTokens?: number; // 선택
  stopSequences?: string[]; // 선택
}

export interface ChatResponseDto {
  messages: ChatMessageDto[];
  model?: string;
  metadata?: Record<string, any>;
}

export interface ChatRagRequestDto {
  chat:ChatRequestDto;
  ragQuery?:string;
  ragTopK?: number; // 선택
  objectType?: string;
  objectId?: string;
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
}

export interface AclActionMaskDto {
  readonly action: string;
  readonly mask: number;
}

export interface SearchRequestDto {
  query?: string | null;
  topK?: number;
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
