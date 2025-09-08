 
import { defineStore } from "pinia";

import type {
  PageableDataSource
} from "@/types/ag-gird";
import { AbstractPageDataSource } from "@/stores/AbstractPageDataSource";

// IPageableRoleDataSource를 정의
type IPageableRoleDataSource = PageableDataSource & {
 
}; 

const fetchUrl = "/api/mgmt/roles";
class PageableRoleDataSource
  extends AbstractPageDataSource
  implements IPageableRoleDataSource
{
  // 생성자에서 부모 클래스의 생성자를 호출
  // 필요한 경우 contentField와 totalField를 변경.
  // constructor() {
  //   super("data", "totalElements"); // ← 필드명 필요 시 변경 가능
  // }
  // API 엔드포인트 URL을 제공
  getFetchUrl(): string {
    return fetchUrl;
  }
}

export const usePageableRolesStore = defineStore("mgmt-pageable-roles-store", () => {
  const dataSource = new PageableRoleDataSource();
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
