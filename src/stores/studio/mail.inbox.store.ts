import { AbstractPageDataSource } from "@/stores/AbstractPageDataSource";
import type { PageableDataSource } from "@/types/ag-gird";
import { defineStore } from "pinia";

type IPageableMailInboxDataSource = PageableDataSource & {
}

const fetchUrl = "/api/mgmt/mail";

class PageableMailInboxDataSource
  extends AbstractPageDataSource
  implements IPageableMailInboxDataSource
{
    getFetchUrl(): string {
        return fetchUrl ;
    }
}
export const usePageableMailInboxStore = defineStore(
  "mgmt-pageable-mail-inbox-store",
  () => {
    const dataSource = new PageableMailInboxDataSource();
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
