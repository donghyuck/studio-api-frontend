import { AbstractPageDataSource } from "@/data/datasource/abstract.page.datasource";
import type { PageableDataSource } from "@/types/ag-gird";
import { defineStore } from "pinia";
  
type IPageableFindUserDataSource = PageableDataSource & {
};

const fetchUrl = "/api/mgmt/users/find";

class PageableFindUserDataSource
  extends AbstractPageDataSource
  implements IPageableFindUserDataSource
{
  // API 엔드포인트 URL을 제공
  getFetchUrl(): string {
    return fetchUrl;
  }
}

export const useFindUserDataSource = defineStore(
  "mgmt-pageable-find-user-store",
  () => {
    const dataSource = new PageableFindUserDataSource();
    return {
      isLoaded: dataSource.isLoaded,
      loading: dataSource.loading,
      error: dataSource.error,
      dataItems: dataSource.dataItems,
      total: dataSource.total,
      pageSize: dataSource.pageSize,
      page: dataSource.page,
      setPageSize: dataSource.setPageSize.bind(dataSource), 
      setSearch: dataSource.setSearch.bind(dataSource),
      setPage: dataSource.setPage.bind(dataSource), 
      setSort: dataSource.setSort.bind(dataSource),
      setFilter: dataSource.setFilter.bind(dataSource),
      fetch: dataSource.fetch.bind(dataSource), 
    };
  }
);
