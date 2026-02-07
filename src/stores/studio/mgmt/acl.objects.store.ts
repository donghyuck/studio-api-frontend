import { createObjectIdentity, deleteObjectIdentity } from "@/data/studio/mgmt/acl";
import type { PageableDataSource } from "@/types/ag-gird";
import type { AclObjectIdentityDto, AclObjectIdentityRequest } from "@/types/studio/acl";
import { defineStore } from "pinia";
import { AbstractPageDataSource } from "@/data/datasource/abstract.page.datasource";

type IAclObjectsDataSource = PageableDataSource & {
  createObjectIdentity(req:AclObjectIdentityRequest):Promise<AclObjectIdentityDto>;
  deleteObjectIdentity(id: number): Promise<void>;
};

const fetchUrl = "/api/security/acl/admin/objects";
class AclObjectsDataSource extends AbstractPageDataSource<AclObjectIdentityDto> implements IAclObjectsDataSource{

    constructor() {
     super("data", "totalElements"); // ← 필드명 필요 시 변경 가능
    }

    getFetchUrl(): string {
        return fetchUrl;
    }
    async createObjectIdentity(payload:AclObjectIdentityRequest): Promise<AclObjectIdentityDto> {
      const created = await createObjectIdentity(payload);
      return created;
    }    
  async deleteObjectIdentity(id: number): Promise<void> {
    await deleteObjectIdentity(id);
  }
}
export const useAclObjectsStore = defineStore(
  "mgmt-security-acl-objects-store",
  () => {
    const dataSource = new AclObjectsDataSource();
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
      setPage: dataSource.setPage.bind(dataSource),
      setSort: dataSource.setSort.bind(dataSource),
      fetch: dataSource.fetch.bind(dataSource), 
      createObjectIdentity: dataSource.createObjectIdentity.bind(dataSource), 
      deleteObjectIdentity: dataSource.deleteObjectIdentity.bind(dataSource), 
    };
  }
);
