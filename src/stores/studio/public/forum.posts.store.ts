import { defineStore } from "pinia";
import { AgGridDataSource } from "@/data/datasource/ag-grid.datasource";
import type { PageableDataSource } from "@/types/ag-gird";
import type { PostResponse } from "@/types/studio/forums";

type PublicForumPostsDataSource = PageableDataSource & {
  setForumSlug(slug: string): void;
  setTopicId(topicId: number): void;
  getForumSlug(): string | undefined;
  getTopicId(): number | undefined;
};

class ForumPostsDataSource
  extends AgGridDataSource<PostResponse>
  implements PublicForumPostsDataSource
{
  private forumSlug?: string;
  private topicId?: number;

  setForumSlug(slug: string) {
    this.forumSlug = slug;
    this.dataItems.value = [];
    this.total.value = 0;
    this.page.value = 0;
  }

  setTopicId(topicId: number) {
    this.topicId = topicId;
    this.dataItems.value = [];
    this.total.value = 0;
    this.page.value = 0;
  }

  getForumSlug() {
    return this.forumSlug;
  }

  getTopicId() {
    return this.topicId;
  }

  getFetchUrl(): string {
    if (!this.forumSlug || !this.topicId) {
      throw new Error("ForumPosts: forumSlug/topicId가 설정되지 않았습니다.");
    }
    return `/api/forums/${encodeURIComponent(this.forumSlug)}/topics/${this.topicId}/posts`;
  }

  getReadUrl(id: string | number): string {
    if (!this.forumSlug || !this.topicId) {
      throw new Error("ForumPosts: forumSlug/topicId가 설정되지 않았습니다.");
    }
    return `/api/forums/${encodeURIComponent(this.forumSlug)}/topics/${this.topicId}/posts/${id}`;
  }
}

export const usePublicForumPostsStore = defineStore(
  "public-pageable-forum-posts-store",
  () => {
    const dataSource = new ForumPostsDataSource();
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
      setTopicId: dataSource.setTopicId.bind(dataSource),
      getForumSlug: dataSource.getForumSlug.bind(dataSource),
      getTopicId: dataSource.getTopicId.bind(dataSource),
    };
  }
);
