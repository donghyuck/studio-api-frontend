import { apiRequest } from "@/react/query/fetcher";
import { API_BASE_URL } from "@/config/backend";
import { authStore } from "@/react/auth/store";
import { parseJwtExp } from "@/utils/jwt";
import type {
  AiInfoResponse,
  ChatRagRequestDto,
  ChatRequestDto,
  ChatResponseDto,
  ChatStreamCompleteEventDto,
  ChatStreamDeltaEventDto,
  ChatStreamUsageEventDto,
  ChatStreamErrorEventDto,
  ConversationDeleteResponseDto,
  ConversationDetailDto,
  ConversationSummaryDto,
  QueryRewriteRequestDto,
  QueryRewriteResponseDto,
  RagChunkingSimulationRequestDto,
  RagChunkingSimulationResponseDto,
  ProjectionCreateRequest,
  ProjectionCreateResponse,
  ProjectionListResponse,
  ProjectionPointsResponse,
  RagChunkConfigResponseDto,
  RagChunkPreviewRequestDto,
  RagChunkPreviewResponseDto,
  RagContextSimulationRequestDto,
  RagContextSimulationResponseDto,
  RagIndexChunkDto,
  RagIndexChunkPageResponseDto,
  RagIndexJobCreateRequestDto,
  RagIndexJobDto,
  RagIndexJobListResponseDto,
  RagIndexJobLogDto,
  RagIndexJobStatus,
  SearchRequestDto,
  SearchResponseDto,
  SearchVisualizationRequest,
  SearchVisualizationResponse,
  RegenerateRequestDto,
  RagRegenerateRequestDto,
  RagAnswerPolicyCapabilitiesDto,
  RagChatCapabilitiesDto,
  RagStreamStatusEventDto,
  VectorItemDetail,
  VectorProjection,
  VectorSearchRequestDto,
  VectorSearchResultDto,
  VectorItemDetailDto,
  VectorProjectionCreateRequestDto,
  VectorProjectionCreateResponseDto,
  VectorProjectionDetailDto,
  VectorProjectionListResponseDto,
  VectorProjectionPointsResponseDto,
  VectorSearchVisualizationRequestDto,
  VectorSearchVisualizationResponseDto,
  VectorProjectionEstimateRequest,
  VectorProjectionEstimateResponse,
  WebKnowledgeSourceCreateRequest,
  WebKnowledgeSourceDto,
} from "@/types/studio/ai";

const BASE = "/api/ai";
const MGMT_BASE = "/api/mgmt/ai";

function isTokenExpired(token: string, skewSeconds = 30) {
  const exp = parseJwtExp(token);
  if (!exp) return true;
  return exp < Math.floor(Date.now() / 1000) + skewSeconds;
}

async function getAccessTokenForFetch() {
  const state = authStore.getState();
  let token = state.token;

  if (!token) {
    token = await state.refreshTokens();
  } else if (isTokenExpired(token)) {
    token = await state.refreshTokens();
  }

  return token;
}

let embeddingOptionsCachePromise: Promise<{ options: EmbeddingOption[] }> | null = null;

type ChatStreamHandlers = {
  onDelta?: (payload: ChatStreamDeltaEventDto) => void;
  onUsage?: (payload: ChatStreamUsageEventDto) => void;
  onComplete?: (payload: ChatStreamCompleteEventDto) => void;
  onRagStatus?: (payload: RagStreamStatusEventDto) => void;
  onError?: (payload: ChatStreamErrorEventDto) => void;
};

async function consumeChatStream(
  path: string,
  req: ChatRequestDto | ChatRagRequestDto,
  handlers: ChatStreamHandlers
) {
  const token = await getAccessTokenForFetch();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify(req),
  });

  if (!response.ok || !response.body) {
    throw new Error(`채팅 스트림 요청에 실패했습니다. (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const flush = (rawBlock: string) => {
    const lines = rawBlock.split(/\r?\n/);
    let currentEvent = "message";
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("event:")) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
    const data = dataLines.join("\n").trim();
    if (!data) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      throw new Error(`채팅 스트림 응답을 해석할 수 없습니다. (${currentEvent})`);
    }

    if (currentEvent === "delta") {
      handlers.onDelta?.(parsed as ChatStreamDeltaEventDto);
    } else if (currentEvent === "usage") {
      handlers.onUsage?.(parsed as ChatStreamUsageEventDto);
    } else if (currentEvent === "rag_status") {
      handlers.onRagStatus?.(parsed as RagStreamStatusEventDto);
    } else if (currentEvent === "complete") {
      handlers.onComplete?.(parsed as ChatStreamCompleteEventDto);
    } else if (currentEvent === "error") {
      handlers.onError?.(parsed as ChatStreamErrorEventDto);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() ?? "";
    chunks.forEach(flush);
  }
  if (buffer.trim()) flush(buffer);
}

export const reactAiApi = {
  sendChat(req: ChatRequestDto) {
    return apiRequest<ChatResponseDto>("post", `${BASE}/chat`, { data: req });
  },

  sendRagChat(req: ChatRagRequestDto) {
    return apiRequest<ChatResponseDto>("post", `${BASE}/chat/rag`, { data: req });
  },

  fetchDeployments(params?: { workload?: string }) {
    return apiRequest<any[]>("get", `${MGMT_BASE}/deployments`, { params });
  },

  sendRagChatStream(
    req: ChatRagRequestDto,
    handlers: {
      onDelta?: (payload: ChatStreamDeltaEventDto) => void;
      onUsage?: (payload: ChatStreamUsageEventDto) => void;
      onComplete?: (payload: ChatStreamCompleteEventDto) => void;
      onRagStatus?: (payload: RagStreamStatusEventDto) => void;
      onError?: (payload: ChatStreamErrorEventDto) => void;
    }
  ) {
    return consumeChatStream(`${BASE}/chat/rag/stream`, req, handlers);
  },

  fetchRagAnswerPolicy() {
    return apiRequest<RagAnswerPolicyCapabilitiesDto>("get", `${BASE}/chat/rag/answer-policy`);
  },

  fetchRagCapabilities() {
    return apiRequest<RagChatCapabilitiesDto>("get", `${BASE}/chat/rag/capabilities`);
  },

  listWebKnowledgeSources(workspaceId: number, embeddingDeploymentId?: string) {
    return apiRequest<WebKnowledgeSourceDto[]>(
      "get",
      `/api/workspaces/${workspaceId}/ai/rag/web-sources`,
      { params: { embeddingDeploymentId } }
    );
  },

  createWebKnowledgeSource(
    workspaceId: number,
    payload: WebKnowledgeSourceCreateRequest
  ) {
    return apiRequest<WebKnowledgeSourceDto, WebKnowledgeSourceCreateRequest>(
      "post",
      `/api/workspaces/${workspaceId}/ai/rag/web-sources`,
      { data: payload }
    );
  },

  refreshWebKnowledgeSource(workspaceId: number, sourceId: string) {
    return apiRequest<WebKnowledgeSourceDto>(
      "post",
      `/api/workspaces/${workspaceId}/ai/rag/web-sources/${encodeURIComponent(sourceId)}/refresh`
    );
  },

  cancelWebKnowledgeSource(workspaceId: number, sourceId: string) {
    return apiRequest<WebKnowledgeSourceDto>(
      "post",
      `/api/workspaces/${workspaceId}/ai/rag/web-sources/${encodeURIComponent(sourceId)}/cancel`
    );
  },

  archiveWebKnowledgeSource(workspaceId: number, sourceId: string) {
    return apiRequest<void>(
      "delete",
      `/api/workspaces/${workspaceId}/ai/rag/web-sources/${encodeURIComponent(sourceId)}`
    );
  },

  fetchProviders() {
    return apiRequest<AiInfoResponse>("get", `${BASE}/info/providers`);
  },

  listConversations() {
    return apiRequest<ConversationSummaryDto[]>("get", `${BASE}/chat/conversations`);
  },

  getConversation(conversationId: string) {
    return apiRequest<ConversationDetailDto>("get", `${BASE}/chat/conversations/${encodeURIComponent(conversationId)}`);
  },

  deleteConversation(conversationId: string) {
    return apiRequest<ConversationDeleteResponseDto>("delete", `${BASE}/chat/conversations/${encodeURIComponent(conversationId)}`);
  },

  regenerate(req: RegenerateRequestDto) {
    return apiRequest<ChatResponseDto>("post", `${BASE}/chat/regenerate`, { data: req });
  },

  regenerateRag(req: RagRegenerateRequestDto) {
    return apiRequest<ChatResponseDto>("post", `${BASE}/chat/rag/regenerate`, { data: req });
  },

  async sendChatStream(
    req: ChatRequestDto,
    handlers: {
      onDelta?: (payload: ChatStreamDeltaEventDto) => void;
      onUsage?: (payload: ChatStreamUsageEventDto) => void;
      onComplete?: (payload: ChatStreamCompleteEventDto) => void;
    }
  ) {
    return consumeChatStream(`${BASE}/chat/stream`, req, handlers);
  },

  searchVector(req: VectorSearchRequestDto) {
    return apiRequest<VectorSearchResultDto[]>("post", `${MGMT_BASE}/vectors/search`, { data: req });
  },

  createVectorProjection(req: ProjectionCreateRequest) {
    return apiRequest<ProjectionCreateResponse>("post", `${MGMT_BASE}/vectors/projections`, { data: req });
  },

  estimateVectorProjection(payload: VectorProjectionEstimateRequest) {
    return apiRequest<VectorProjectionEstimateResponse>(
      "post",
      `${MGMT_BASE}/vectors/projections/estimate`,
      { data: payload }
    );
  },

  async listVectorProjections(params?: { limit?: number; offset?: number }) {
    const response = await apiRequest<ProjectionListResponse>("get", `${MGMT_BASE}/vectors/projections`, { params });
    return response.items ?? [];
  },

  getVectorProjection(projectionId: string) {
    return apiRequest<VectorProjection>("get", `${MGMT_BASE}/vectors/projections/${encodeURIComponent(projectionId)}`);
  },

  deleteVectorProjection(projectionId: string) {
    return apiRequest<void>(
      "delete",
      `${MGMT_BASE}/vectors/projections/${encodeURIComponent(projectionId)}`
    );
  },


  getVectorProjectionPoints(
    projectionId: string,
    params?: {
      targetType?: string;
      clusterId?: string;
      keyword?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    return apiRequest<ProjectionPointsResponse>(
      "get",
      `${MGMT_BASE}/vectors/projections/${encodeURIComponent(projectionId)}/points`,
      { params }
    );
  },

  getVectorItem(vectorItemId: string) {
    return apiRequest<VectorItemDetail>("get", `${MGMT_BASE}/vectors/items/${encodeURIComponent(vectorItemId)}`);
  },

  searchVectorVisualization(req: SearchVisualizationRequest) {
    return apiRequest<SearchVisualizationResponse>("post", `${MGMT_BASE}/vectors/search-visualization`, { data: req });
  },

  async searchRag(req: SearchRequestDto) {
    const response = await apiRequest<SearchResponseDto>("post", `/api/mgmt/files/rag/search`, { data: req });
    return response.results ?? [];
  },

  listRagJobs(params?: {
    status?: RagIndexJobStatus | "";
    objectType?: string;
    objectId?: string;
    documentId?: string;
    page?: number;
    size?: number;
    sort?: string;
    direction?: "asc" | "desc";
  }) {
    return apiRequest<RagIndexJobListResponseDto>("get", `${MGMT_BASE}/rag/jobs`, { params });
  },

  getRagJob(jobId: string) {
    return apiRequest<RagIndexJobDto>("get", `${MGMT_BASE}/rag/jobs/${encodeURIComponent(jobId)}`);
  },

  createRagJob(req: RagIndexJobCreateRequestDto) {
    return apiRequest<RagIndexJobDto>("post", `${MGMT_BASE}/rag/jobs`, { data: req });
  },

  retryRagJob(jobId: string) {
    return apiRequest<RagIndexJobDto>("post", `${MGMT_BASE}/rag/jobs/${encodeURIComponent(jobId)}/retry`);
  },

  cancelRagJob(jobId: string) {
    return apiRequest<RagIndexJobDto>("post", `${MGMT_BASE}/rag/jobs/${encodeURIComponent(jobId)}/cancel`);
  },

  deleteRagJob(jobId: string) {
    return apiRequest<void>("delete", `${MGMT_BASE}/rag/jobs/${encodeURIComponent(jobId)}`);
  },

  deleteRagObject(objectType: string, objectId: string) {
    return apiRequest<void>(
      "delete",
      `${MGMT_BASE}/rag/objects/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}`
    );
  },

  getRagJobLogs(jobId: string) {
    return apiRequest<RagIndexJobLogDto[]>("get", `${MGMT_BASE}/rag/jobs/${encodeURIComponent(jobId)}/logs`);
  },

  getRagJobChunks(jobId: string, page = 0, size = 200) {
    return apiRequest<RagIndexChunkPageResponseDto>("get", `${MGMT_BASE}/rag/jobs/${encodeURIComponent(jobId)}/chunks`, {
      params: { page, size },
    });
  },

  getRagObjectChunksPage(objectType: string, objectId: string, page = 0, size = 50) {
    return apiRequest<RagIndexChunkPageResponseDto>(
      "get",
      `${MGMT_BASE}/rag/objects/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}/chunks`,
      { params: { page, size } }
    );
  },

  getRagObjectMetadata(objectType: string, objectId: string) {
    return apiRequest<Record<string, unknown>>(
      "get",
      `${MGMT_BASE}/rag/objects/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}/metadata`
    );
  },


  getRagChunkConfig() {
    return apiRequest<RagChunkConfigResponseDto>("get", `${MGMT_BASE}/rag/chunks/config`);
  },

  previewRagChunks(req: RagChunkPreviewRequestDto) {
    return apiRequest<RagChunkPreviewResponseDto>("post", `${MGMT_BASE}/rag/chunks/preview`, { data: req });
  },

  simulateRagChunking(req: RagChunkingSimulationRequestDto) {
    return apiRequest<RagChunkingSimulationResponseDto>("post", `${MGMT_BASE}/rag/simulations/chunking`, {
      data: req,
    });
  },

  simulateRagContext(req: RagContextSimulationRequestDto) {
    return apiRequest<RagContextSimulationResponseDto>("post", `${MGMT_BASE}/rag/simulations/context`, {
      data: req,
    });
  },

  rewriteQuery(req: QueryRewriteRequestDto) {
    return apiRequest<QueryRewriteResponseDto>("post", `${BASE}/query-rewrite`, { data: req });
  },

  getEmbeddingOptions() {
    if (!embeddingOptionsCachePromise) {
      embeddingOptionsCachePromise = apiRequest<{ options: EmbeddingOption[] }>("get", `${BASE}/embedding-options`).catch((err) => {
        embeddingOptionsCachePromise = null;
        throw err;
      });
    }
    return embeddingOptionsCachePromise;
  },
};

export interface EmbeddingOption {
  deploymentId?: string | null;
  catalogId?: string | null;
  profileId: string | null;
  modelId?: string | null;
  displayName?: string | null;
  embeddingSpaceId?: string | null;
  aliases?: string[];
  provider: string;
  providerType: string | null;
  model: string;
  dimension: number;
  supportedInputTypes: string[] | null;
  defaultProvider: boolean;
  defaultProfile: boolean;
  profile: boolean;
  source: string | null;
}
