import { AgGridDataSource, createAgGridStore } from "@/data/datasource/ag-grid.datasource";
import type { PageableDataSource } from "@/types/ag-gird";
import type { ForumResponse, ForumSummaryResponse } from "@/types/studio/forums";

class PublicForumListDataSource
  extends AgGridDataSource<ForumSummaryResponse, ForumResponse>
  implements PageableDataSource<ForumSummaryResponse, ForumResponse>
{
  getFetchUrl(): string {
    return "/api/forums";
  }

  getReadUrl(id: string | number): string {
    return `/api/forums/${encodeURIComponent(String(id))}`;
  }
}

export const usePublicForumListStore = createAgGridStore(
  "public-pageable-forum-list-store",
  () => new PublicForumListDataSource()
);
