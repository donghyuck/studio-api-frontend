import type { IsoInstant } from "@/types/studio/api-common";

export interface TemplateDto {
  templateId: number;
  objectType: number;
  objectId: number;
  name: string;
  displayName?: string | null;
  description?: string | null;
  subject?: string | null;
  body?: string | null;
  createdBy: number;
  updatedBy: number;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
  properties?: Record<string, string> | null;
}
export type TemplateSummaryDto = Omit<TemplateDto, "body" | "properties"> & {
  body?: undefined;
  properties?: undefined;
};
export interface TemplateRequest {
  objectType: number;
  objectId: number;
  name: string;
  displayName?: string | null;
  description?: string | null;
  subject?: string | null;
  body?: string | null;
  properties?: Record<string, string> | null;
}

/** render body/subject용 model payload */
export type TemplateRenderModel = Record<string, unknown>;

export interface TemplateRenderResponse {
  success: boolean;
  data: string;
}
