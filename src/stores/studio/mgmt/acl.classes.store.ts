import {
  createAclClass,
  deleteAclClass,
  deleteAclClasss,
} from "@/data/studio/mgmt/acl";
import type { PageableDataSource } from "@/types/ag-gird";
import type { AclClassDto } from "@/types/studio/acl";
import { defineStore } from "pinia";
import { AbstractPageDataSource } from "@/data/datasource/abstract.page.datasource";

type IAclClassesDataSource = PageableDataSource & {
  createClass(name: string): Promise<AclClassDto>;
  deleteClasses(ids: number[]): Promise<void>;
  deleteClass(id: number): Promise<void>;
};

const fetchUrl = "/api/security/acl/admin/classes";
class AclClassesDataSource
  extends AbstractPageDataSource<AclClassDto>
  implements IAclClassesDataSource
{
  constructor() {
    super("data", "totalElements"); // ← 필드명 필요 시 변경 가능
  }
  
  async deleteClasses(ids: number[]): Promise<void> {
    await deleteAclClasss(ids);
  }

  async deleteClass(id: number): Promise<void> {
    await deleteAclClass(id);
  }

  async createClass(name: string): Promise<AclClassDto> {
    const created = await createAclClass({ className: name });
    return created;
  }

  getFetchUrl(): string {
    return fetchUrl;
  }
}
export const useAclClassesStore = defineStore(
  "mgmt-security-acl-classes-store",
  () => {
    const dataSource = new AclClassesDataSource();
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
      createClass: dataSource.createClass.bind(dataSource),
      deleteClasses: dataSource.deleteClasses.bind(dataSource),
      deleteClass: dataSource.deleteClass.bind(dataSource),
    };
  }
);
