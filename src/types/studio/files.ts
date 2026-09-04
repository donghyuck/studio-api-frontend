import type { UserDto } from "./user";
import type { RagObjectIndexStatusDto } from "./ai";

export interface AttachmentDto {
  attachmentId: number;
  objectType: number;
  objectId: number;
  name: string;
  contentType: string;
  size: number;
  createdBy: UserDto| null;
  createdAt: Date | null;
  updatedAt?: Date | null;
  properties?: Record<string, any>;
  ragIndexStatus?: RagObjectIndexStatusDto | null;
}


export const emptyAttachment = (
  overrides?: Partial<AttachmentDto>
): AttachmentDto => ({
  attachmentId: 0,
  objectType: 0,
  objectId: 0,
  name: "",
  contentType: "",
  size: 0,
  createdBy: null,
  createdAt: null,
  updatedAt: null,
  properties: {},
  ...overrides,
});
