import { AbstractPageDataSource } from "@/stores/AbstractPageDataSource";
import type { PageableDataSource } from "@/types/ag-gird";
import { defineStore } from "pinia";

type IPageableMailSyncLogDataSource = PageableDataSource & {
}

const fetchUrl = "/api/mgmt/mail/sync/logs/page";

class PageableMailSyncLogDataSource
  extends AbstractPageDataSource
  implements IPageableMailSyncLogDataSource
{
    getFetchUrl(): string {
        return fetchUrl ;
    }
}
export const usePageableMailSyncLogStore = defineStore(
  "mgmt-pageable-mail-synclog-store",
  () => {
    const dataSource = new PageableMailSyncLogDataSource();
    return {
      isLoaded: dataSource.isLoaded,
      dataItems: dataSource.dataItems,
      total: dataSource.total,
      pageSize: dataSource.pageSize,
      setPageSize: dataSource.setPageSize.bind(dataSource), 
      setFilter: dataSource.setFilter.bind(dataSource),
      setPage: dataSource.setPage.bind(dataSource),
      setSort: dataSource.setSort.bind(dataSource),
      fetch: dataSource.fetch.bind(dataSource), 
    };
  }
);
