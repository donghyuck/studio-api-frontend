import { ReactPageDataSource } from "@/react/pages/admin/datasource";
import type { ForumAuditEvent } from "@/react/pages/forums/admin/auditApi";

export class ForumAuditDataSource extends ReactPageDataSource<ForumAuditEvent> {
  constructor(forumSlug: string) {
    super(`/api/mgmt/forums/${encodeURIComponent(forumSlug)}/audit`);
  }
}
