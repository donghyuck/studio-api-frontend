import { defineStore } from "pinia";
import type { PageableDataSource } from "@/types/ag-gird";
import { AbstractPageDataSource } from "@/data/datasource/abstract.page.datasource";

export interface ForumAuditLogDto {
  auditId: number;
  forumId: number;
  entityType: string;
  entityId: number;
  action?: string;
  actorId?: number;
  at?: string;
  detail?: Record<string, unknown>;
}

type IPageableForumAuditLogDataSource = PageableDataSource & {};

const fetchUrl = "/api/mgmt/forums/audit-logs";

class PageableForumAuditLogDataSource extends AbstractPageDataSource<ForumAuditLogDto> {
  getFetchUrl(): string {
    return fetchUrl;
  }
}

export const usePageableForumAuditLogStore = defineStore(
  "mgmt-pageable-forum-audit-log-store",
  () => {
    const dataSource = new PageableForumAuditLogDataSource();
    return {
      isLoaded: dataSource.isLoaded,
      loading: dataSource.loading,
      error: dataSource.error,
      dataItems: dataSource.dataItems,
      total: dataSource.total,
      pageSize: dataSource.pageSize,
      page: dataSource.page,
      setPageSize: dataSource.setPageSize.bind(dataSource),
      setPage: dataSource.setPage.bind(dataSource),
      setSort: dataSource.setSort.bind(dataSource),
      setSearch: dataSource.setSearch.bind(dataSource),
      setFilter: dataSource.setFilter.bind(dataSource),
      fetch: dataSource.fetch.bind(dataSource),
    };
  }
);
