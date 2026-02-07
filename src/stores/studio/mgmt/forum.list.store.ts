import type { PageableDataSource } from "@/types/ag-gird";
import { AbstractPageDataSource } from "@/data/datasource/abstract.page.datasource";

import { defineStore } from "pinia";
import { ref } from "vue";
import { ADMIN_BASE, forumsAdminApi } from "@/data/studio/mgmt/forums";
import type { PermissionActionMetadata } from "@/types/studio/forums";

type IPageableForumListDataSource = PageableDataSource & {

}
class PageableForumListDataSource
  extends AbstractPageDataSource
  implements IPageableForumListDataSource
{
    getFetchUrl(): string {
        return ADMIN_BASE;
    }
}

export const usePageableForumListStore = defineStore(
  "mgmt-pageable-forum-list-store",
  () => {
    const dataSource = new PageableForumListDataSource();
    const permissionActions = ref<PermissionActionMetadata[]>([]);
    const permissionActionsLoading = ref(false);

    const loadPermissionActions = async (forumSlug: string) => {
      permissionActionsLoading.value = true;
      try {
        const response = await forumsAdminApi.listPermissionActions(forumSlug);
        permissionActions.value = response;
        return permissionActions.value;
      } finally {
        permissionActionsLoading.value = false;
      }
    };
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
      permissionActions,
      permissionActionsLoading,
      loadPermissionActions,
    };
  }
);
