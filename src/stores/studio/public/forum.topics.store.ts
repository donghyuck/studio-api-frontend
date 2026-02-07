import { defineStore } from "pinia";
import { AgGridDataSource } from "@/data/datasource/ag-grid.datasource";
import type { PageableDataSource } from "@/types/ag-gird";
import type { TopicSummaryResponse } from "@/types/studio/forums";

export type PublicForumTopicsDataSource = PageableDataSource & {
  setForumSlug(slug: string): void;
  getForumSlug(): string | undefined;
};

class ForumTopicsDataSource
  extends AgGridDataSource<TopicSummaryResponse>
  implements PublicForumTopicsDataSource
{
  private forumSlug?: string;

  setForumSlug(slug: string) {
    this.forumSlug = slug;
    this.dataItems.value = [];
    this.total.value = 0;
    this.page.value = 0;
  }

  getForumSlug() {
    return this.forumSlug;
  }

  getFetchUrl(): string {
    if (!this.forumSlug) {
      throw new Error("ForumTopics: forumSlug이 설정되지 않았습니다.");
    }
    return `/api/forums/${encodeURIComponent(this.forumSlug)}/topics`;
  }

  getReadUrl(id: string | number): string {
    if (!this.forumSlug) {
      throw new Error("ForumTopics: forumSlug이 설정되지 않았습니다.");
    }
    return `/api/forums/${encodeURIComponent(this.forumSlug)}/topics/${id}`;
  }
}

export const usePublicForumTopicsStore = defineStore(
  "public-pageable-forum-topics-store",
  () => {
    const dataSource = new ForumTopicsDataSource();
    return {
      isLoaded: dataSource.isLoaded,
      loading: dataSource.loading,
      error: dataSource.error,
      dataItems: dataSource.dataItems,
      total: dataSource.total,
      pageSize: dataSource.pageSize,
      page: dataSource.page,
      setPage: dataSource.setPage.bind(dataSource),
      setPageSize: dataSource.setPageSize.bind(dataSource),
      setSort: dataSource.setSort.bind(dataSource),
      setSearch: dataSource.setSearch.bind(dataSource),
      setFilter: dataSource.setFilter.bind(dataSource),
      fetch: dataSource.fetch.bind(dataSource),
      read: dataSource.read?.bind(dataSource),
      setForumSlug: dataSource.setForumSlug.bind(dataSource),
      getForumSlug: dataSource.getForumSlug.bind(dataSource),
    };
  }
);
