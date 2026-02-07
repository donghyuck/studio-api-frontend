import type { PageableDataSource } from "@/types/ag-gird";
import { AbstractPageDataSource } from "@/data/datasource/abstract.page.datasource"; 
import { API_BASE } from "@/data/studio/mgmt/document";
import { defineStore } from "pinia";

type IPageableDocumentListDataSource = PageableDataSource & {

}
class PageableDocumentListDataSource
  extends AbstractPageDataSource
  implements IPageableDocumentListDataSource
{
    getFetchUrl(): string {
        return API_BASE;
    }
}

export const usePageableDocumentListStore = defineStore(
  "mgmt-pageable-document-list-store",
  () => {
    const dataSource = new PageableDocumentListDataSource();
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
    };
  }
);
