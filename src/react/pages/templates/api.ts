import { apiRequest } from "@/react/query/fetcher";
import type { TemplateDto, TemplateRequest } from "@/types/studio/template";

const BASE = "/api/mgmt/templates";

export const reactTemplatesApi = {
  list: (params?: { page?: number; size?: number; q?: string }) =>
    apiRequest<{ content: TemplateDto[]; totalElements: number }>("get", BASE, { params }),

  get: (templateId: number) =>
    apiRequest<TemplateDto>("get", `${BASE}/${templateId}`),

  create: (payload: TemplateRequest) =>
    apiRequest<TemplateDto>("post", BASE, { data: payload }),

  update: (templateId: number, payload: TemplateRequest) =>
    apiRequest<TemplateDto>("put", `${BASE}/${templateId}`, { data: payload }),

  delete: (templateId: number) =>
    apiRequest<void>("delete", `${BASE}/${templateId}`),

  renderBody: (templateId: number, model: Record<string, unknown> = {}) =>
    apiRequest<string>("post", `${BASE}/${templateId}/render/body`, { data: model }),

  renderSubject: (templateId: number, model: Record<string, unknown> = {}) =>
    apiRequest<string>("post", `${BASE}/${templateId}/render/subject`, { data: model }),
};
