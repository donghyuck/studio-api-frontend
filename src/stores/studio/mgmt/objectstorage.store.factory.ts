import { defineStore } from "pinia";
import { useObjectStorageStore } from "./objectstorage.store";

export const createObjectStorageStore = (id:string, pageSize?:number) =>
  defineStore(
  `mgmt-object-storage-${id}-store` ,
  () => {
    const dataSource = useObjectStorageStore();
    dataSource.setProviderId(id);
    if( pageSize )
      dataSource.setPageSize(pageSize);
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
      setFilter: dataSource.setFilter.bind(dataSource),
      getPage:dataSource.getPage.bind(dataSource),
      setPage: dataSource.setPage.bind(dataSource),
      setSort: dataSource.setSort.bind(dataSource),
      fetch: dataSource.fetch.bind(dataSource),
      getProviderId: dataSource.getProviderId.bind(dataSource),
      setProviderId: dataSource.setProviderId.bind(dataSource),
      getBuckets : dataSource.getBuckets.bind(dataSource),
      setContext: dataSource.setContext.bind(dataSource),
      getObjects: dataSource.getObjects.bind(dataSource),
      breadcrumb: dataSource.breadcrumb.bind(dataSource),
      hasMore: dataSource.hasMore.bind(dataSource),
      getPrefix: dataSource.getPrefix.bind(dataSource),
    };
  }
);
