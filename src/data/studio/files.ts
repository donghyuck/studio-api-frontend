import type { RagIndexRequestDto, SearchRequestDto, SearchResponseDto, SearchResultDto } from "@/types/studio/ai";
import type { AttachmentDto } from "@/types/studio/files";
import { api } from "@/utils/http";

const API_BASE = "/api/mgmt/files";

export async function getFileById(id: number) {
  const data = await api.get<AttachmentDto>(`${API_BASE}/${id}`);
  return data;
}

export async function extractText(id: number) {
  const data = await api.get<string>(`${API_BASE}/${id}/text`);
  return data;
}

export async function embedding(id: number) {
  const data = await api.get(`${API_BASE}/${id}/embedding`);
  return data;
}

export async function hasEmbedding(id: number) {
  const data = await api.get<boolean>(`${API_BASE}/${id}/embedding/exists`);
  return data;
}

export async function ragIndex(id: number, opt?: Partial<RagIndexRequestDto>) {
  await api.post(`${API_BASE}/${id}/rag/index`, opt ?? {});
}

export async function ragSearch(req: SearchRequestDto) {
  const data = await api.post<SearchResponseDto>(`${API_BASE}/rag/search`, req);
  return data;
}
export async function ragMetadata(id: number) {
  const data = await api.get<Record<string, unknown>>(`${API_BASE}/${id}/rag/metadata`);
  return data;
}
