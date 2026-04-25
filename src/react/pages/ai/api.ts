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
  ConversationDeleteResponseDto,
  ConversationDetailDto,
  ConversationSummaryDto,
  QueryRewriteRequestDto,
  QueryRewriteResponseDto,
  RegenerateRequestDto,
  VectorSearchRequestDto,
  VectorSearchResultDto,
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

export const reactAiApi = {
  sendChat(req: ChatRequestDto) {
    return apiRequest<ChatResponseDto>("post", `${BASE}/chat`, { data: req });
  },

  sendRagChat(req: ChatRagRequestDto) {
    return apiRequest<ChatResponseDto>("post", `${BASE}/chat/rag`, { data: req });
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

  async sendChatStream(
    req: ChatRequestDto,
    handlers: {
      onDelta?: (payload: ChatStreamDeltaEventDto) => void;
      onUsage?: (payload: ChatStreamUsageEventDto) => void;
      onComplete?: (payload: ChatStreamCompleteEventDto) => void;
    }
  ) {
    const token = await getAccessTokenForFetch();
    const response = await fetch(`${API_BASE_URL}${BASE}/chat/stream`, {
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
      if (!data) {
        return;
      }
      let parsed:
        | ChatStreamDeltaEventDto
        | ChatStreamUsageEventDto
        | ChatStreamCompleteEventDto;
      try {
        parsed = JSON.parse(data) as
          | ChatStreamDeltaEventDto
          | ChatStreamUsageEventDto
          | ChatStreamCompleteEventDto;
      } catch {
        throw new Error(`채팅 스트림 응답을 해석할 수 없습니다. (${currentEvent})`);
      }

      if (currentEvent === "delta") {
        handlers.onDelta?.(parsed as ChatStreamDeltaEventDto);
      } else if (currentEvent === "usage") {
        handlers.onUsage?.(parsed as ChatStreamUsageEventDto);
      } else if (currentEvent === "complete") {
        handlers.onComplete?.(parsed as ChatStreamCompleteEventDto);
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split(/\r?\n\r?\n/);
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        flush(chunk);
      }
    }

    if (buffer.trim()) {
      flush(buffer);
    }
  },

  searchVector(req: VectorSearchRequestDto) {
    return apiRequest<VectorSearchResultDto[]>("post", `${MGMT_BASE}/vectors/search`, { data: req });
  },

  rewriteQuery(req: QueryRewriteRequestDto) {
    return apiRequest<QueryRewriteResponseDto>("post", `${BASE}/query-rewrite`, { data: req });
  },
};
