import { ReactPageDataSource } from "@/react/pages/admin/datasource";
import type { ForumSummaryResponse } from "@/types/studio/forums";

export class ForumListDataSource extends ReactPageDataSource<ForumSummaryResponse> {
  constructor() {
    super("/api/mgmt/forums");
  }
}
