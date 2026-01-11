import api from "@/plugins/axios";
import type {
  TemplateDto,
  TemplateRenderModel,
  TemplateRequest,
  TemplateRenderResponse,
} from "@/types/studio/template";

const API_BASE = "/api/mgmt/templates";

export async function createTemplate(
  payload: TemplateRequest
): Promise<TemplateDto> {
  const created = await api.post<TemplateDto>(API_BASE, payload);
  return created;
}

export async function updateTemplate(
  templateId: number,
  payload: TemplateRequest
): Promise<TemplateDto> {
  const updated = await api.put<TemplateDto>(
    `${API_BASE}/${templateId}`,
    payload
  );
  return updated;
}
export async function deleteTemplate(templateId: number): Promise<void> {
  const deleted = await api.delete<void>(`${API_BASE}/${templateId}`);
  return deleted;
}

export async function renderBody(
  templateId: number,
  model?: TemplateRenderModel
) {
  const res = await api.post<TemplateRenderResponse>(
    `${API_BASE}/${templateId}/render/body`,
    model ?? {}
  );
  return res.data;
}
export async function renderSubject(
  templateId: number,
  model?: TemplateRenderModel
) {
  const res = await api.post<TemplateRenderResponse>(
    `${API_BASE}/${templateId}/render/subject`,
    model ?? {}
  );
  return res.data;
}
