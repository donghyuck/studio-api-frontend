import { apiRequest } from "@/react/query/fetcher";
import type {
  AiInfoResponse,
  ChatRagRequestDto,
  ChatRequestDto,
  ChatResponseDto,
  QueryRewriteRequestDto,
  QueryRewriteResponseDto,
  VectorSearchRequestDto,
  VectorSearchResultDto,
} from "@/types/studio/ai";

const BASE = "/api/ai";

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

  searchVector(req: VectorSearchRequestDto) {
    return apiRequest<VectorSearchResultDto[]>("post", `${BASE}/vectors/search`, { data: req });
  },

  rewriteQuery(req: QueryRewriteRequestDto) {
    return apiRequest<QueryRewriteResponseDto>("post", `${BASE}/query-rewrite`, { data: req });
  },
};
