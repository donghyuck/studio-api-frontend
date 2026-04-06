import type { PageResponse } from "@/types/studio/api-common";

export interface ForumAuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: Record<string, unknown>;
  forumSlug: string;
}
