import { defineStore } from "pinia";
import { api } from "@/data/http";
import type { PageableDataSource } from "@/types/ag-gird";
import { AbstractPageDataSource } from "@/data/datasource/abstract.page.datasource"; 

export interface LoginFailureDto {
    id:number;  
    username:string;
    occurredAt:string; 
    remoteIp:string;       
    userAgent:string;
    failureType:string;
    message:string;
}

type IPageableLoginFailureLogDataSource = PageableDataSource & {
};

const fetchUrl = "/api/mgmt/audit/login-failure-log";

class PageableLoginFailureLogDataSource
  extends AbstractPageDataSource 
{
  getFetchUrl(): string {
    return fetchUrl;
  }
}

export const usePageableLoginFailureLogStore = defineStore(
  "mgmt-pageable-login-failure-log-store",
  () => {
    const dataSource = new PageableLoginFailureLogDataSource();
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
