import { defineStore } from "pinia";
import type { PageableDataSource, PageQuery, FetchOptions } from "@/types/ag-gird";
import { AbstractPageDataSource } from "@/data/datasource/abstract.page.datasource";
import type { ObjectTypeDto } from "@/types/studio/objecttype";
import { objectTypeAdminApi } from "@/data/studio/mgmt/objecttype";

type ObjectTypeListDataSourceType = PageableDataSource<ObjectTypeDto> & {};

class ObjectTypeListDataSource
  extends AbstractPageDataSource<ObjectTypeDto>
  implements ObjectTypeListDataSourceType
{
  async fetch(query?: PageQuery, _options?: FetchOptions): Promise<void> {
    this.isLoaded.value = false;
    this.loading.value = true;
    this.error.value = null;
    if (query?.q !== undefined) this.setSearch(query.q);
    try {
      const params = { ...(this.filter.value ?? {}) };
      const list = await objectTypeAdminApi.list(params);
      const rows = Array.isArray(list) ? list : [];
      this.dataItems.value = rows;
      this.total.value = rows.length;
      this.numberOfElements.value = rows.length;
      this.page.value = 0;
    } catch (error: any) {
      this.error.value = error;
    } finally {
      this.loading.value = false;
      this.isLoaded.value = true;
    }
  }

  getFetchUrl(): string {
    return "/api/mgmt/object-types";
  }
}

export const useObjectTypeListStore = defineStore(
  "mgmt-object-type-list-store",
  () => {
    const dataSource = new ObjectTypeListDataSource();
    return {
      isLoaded: dataSource.isLoaded,
      loading: dataSource.loading,
      error: dataSource.error,
      dataItems: dataSource.dataItems,
      total: dataSource.total,
      pageSize: dataSource.pageSize,
      page: dataSource.page,
      setPageSize: dataSource.setPageSize.bind(dataSource),
      setFilter: dataSource.setFilter.bind(dataSource),
      setSearch: dataSource.setSearch.bind(dataSource),
      setPage: dataSource.setPage.bind(dataSource),
      setSort: dataSource.setSort.bind(dataSource),
      fetch: dataSource.fetch.bind(dataSource),
    };
  }
);
