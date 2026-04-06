import { apiQuery } from "@/react/query/fetcher";
import type { PageResponse } from "@/types/studio/api-common";

export interface ForumAuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: Record<string, unknown>;
  forumSlug: string;
}

export const forumAuditApi = {
  getForumAuditEvents: (forumSlug: string, page: number, size: number) => {
    const encodedForumSlug = encodeURIComponent(forumSlug);
    return apiQuery<PageResponse<ForumAuditEvent>>(`/api/mgmt/forums/${encodedForumSlug}/audit?page=${page}&size=${size}`);
  },
};
