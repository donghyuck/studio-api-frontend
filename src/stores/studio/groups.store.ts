 
import { defineStore } from "pinia";

import type {
  PageableDataSource
} from "@/types/ag-gird";
import { AbstractPageDataSource } from "@/stores/AbstractPageDataSource";

// IPageableRoleDataSource를 정의
type IPageableGroupDataSource = PageableDataSource & {
 
}; 

const fetchUrl = "/api/mgmt/groups";
class PageableGroupDataSource
  extends AbstractPageDataSource
  implements IPageableGroupDataSource
{
  getFetchUrl(): string {
    return fetchUrl;
  }
}

export const usePageableGroupsStore = defineStore("mgmt-pageable-groups-store", () => {
  const dataSource = new PageableGroupDataSource();
  return {      
    isLoaded: dataSource.isLoaded,
    dataItems: dataSource.dataItems,
    total: dataSource.total,    
    pageSize: dataSource.pageSize, 
    setFilter: dataSource.setFilter.bind(dataSource),
    setPage: dataSource.setPage.bind(dataSource),
    setSort: dataSource.setSort.bind(dataSource), 
    fetch: dataSource.fetch.bind(dataSource),
  };
});
