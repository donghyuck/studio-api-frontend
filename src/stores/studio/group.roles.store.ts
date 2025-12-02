import { AbstractPageDataSource } from "@/stores/AbstractPageDataSource";
import type { PageableDataSource } from "@/types/ag-gird";
import { api } from "@/utils/http";
import { defineStore } from "pinia";
import type { RoleDto } from "./roles.store";
 
type IGroupRolesDataSource = PageableDataSource & {
  setGroupId(groupId: number): void;
  getGroupId(): number | undefined;
  update(roles: RoleDto[]): Promise<void>;
};

class GroupRolesDataSource
  extends AbstractPageDataSource
  implements IGroupRolesDataSource
{
  private groupId?: number;
  
  constructor() {
    super("data", "totalElements");  
  }

  setGroupId(groupId: number) {
    this.groupId = groupId;
    this.dataItems.value = [];
    this.total.value = 0;
    this.page.value = 0;
  }
  getGroupId() {
    return this.groupId;
  }

  // API 엔드포인트 URL을 제공
  getFetchUrl(): string {
    if (!this.groupId) {
      throw new Error(
        "GroupRoles: groupId가 설정되지 않았습니다. setGroupId(gid) 호출이 필요합니다."
      );
    }
    return `/api/mgmt/groups/${this.groupId}/roles`;
  }

  async update(roles: RoleDto[]): Promise<void>{
      await api.post(this.getFetchUrl(), roles); 
  }

}

export const useGroupRolesStore = defineStore(
  "mgmt-group-roles-store",
  () => {
    const dataSource = new GroupRolesDataSource();
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
      setGroupId: dataSource.setGroupId.bind(dataSource),
      getGroupId: dataSource.getGroupId.bind(dataSource),
      update: dataSource.update.bind(dataSource),
    };
  }
);
