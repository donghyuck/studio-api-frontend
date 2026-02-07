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
import { api } from "@/data/http";
import { ref } from "vue";

const fetchUrl = "/api/ai";

export async function sendChat(req: ChatRequestDto): Promise<ChatResponseDto> {
  const payload = await api.post<ChatResponseDto>(fetchUrl + "/chat", req);
  return payload;
}

export async function setdRagChat(req:ChatRagRequestDto):Promise<ChatResponseDto> {
  const payload = await api.post<ChatResponseDto>(fetchUrl + "/chat/rag", req);
  return payload;
}

const providers = ref<AiInfoResponse>();

export async function fetchProviders(force:boolean = true): Promise<AiInfoResponse> {

  if( !force && providers.value ){
    return providers.value;
  }

  const payload = await api.get<AiInfoResponse>(fetchUrl + "/info/providers");
  providers.value = payload; 
  return payload;
}

export async function searchVector( req : VectorSearchRequestDto ){
  const payload = await api.post<VectorSearchResultDto[]>(fetchUrl+"/vectors/search", req);
  return payload;
}


export async function rewriteQuery(req : QueryRewriteRequestDto ){
  const payload = await api.post<QueryRewriteResponseDto>(fetchUrl+"/query-rewrite", req);
  return payload;
}
