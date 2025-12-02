import { AbstractPageDataSource } from "@/stores/AbstractPageDataSource";
import type { PageableDataSource } from "@/types/ag-gird";
import { api } from "@/utils/http";
import { defineStore } from "pinia";
import type { RoleDto } from "./roles.store";
 
type IUserRolesDataSource = PageableDataSource & {
  setUserId(groupId: number): void;
  getUserId(): number | undefined;
  update(roles: RoleDto[]): Promise<void>;
  getUserRoles():Promise<RoleDto[]| undefined>;
  getUserGroupsRoles():Promise<RoleDto[]| undefined>;
};

class UserRolesDataSource
  extends AbstractPageDataSource
  implements IUserRolesDataSource
{
  private userId?: number;
  
  constructor() {
    super("data", "totalElements");  
  }

  setUserId(userId: number) {
    this.userId = userId;
    this.dataItems.value = [];
    this.total.value = 0;
    this.page.value = 0;
  }
  getUserId() {
    return this.userId;

  }
  getFetchUrl(): string {
    if (!this.userId) {
      throw new Error(
        "UserRoles: userId가 설정되지 않았습니다. setUserId(gid) 호출이 필요합니다."
      );
    }
    return `/api/mgmt/users/${this.userId}/roles`;
  }

  async update(roles: RoleDto[]): Promise<void>{
     await api.post(this.getFetchUrl(), roles); 
  }

  async getUserRoles(): Promise<RoleDto[]> {
     const payload = await api.get<RoleDto[]>( this.getFetchUrl() + "?by=user" );
     return payload;
  }

  async getUserGroupsRoles(): Promise<RoleDto[]> {
      const payload = await api.get<RoleDto[]>( this.getFetchUrl() + "?by=group" );
      return payload;
  }

}

export const useUserRolesStore = defineStore(
  "mgmt-user-roles-store",
  () => {
    const dataSource = new UserRolesDataSource();
    return {
      isLoaded: dataSource.isLoaded,
      dataItems: dataSource.dataItems,
      total: dataSource.total,
      pageSize: dataSource.pageSize,
      setFilter: dataSource.setFilter.bind(dataSource),
      setPage: dataSource.setPage.bind(dataSource),
      setPageSize: dataSource.setPageSize.bind(dataSource), 
      setSort: dataSource.setSort.bind(dataSource),
      fetch: dataSource.fetch.bind(dataSource),
      setUserId: dataSource.setUserId.bind(dataSource),
      getUserId: dataSource.getUserId.bind(dataSource),
      update: dataSource.update.bind(dataSource),
      getUserRoles: dataSource.getUserRoles.bind(dataSource),
      getUserGroupsRoles: dataSource.getUserGroupsRoles.bind(dataSource),
    };
  }
);
