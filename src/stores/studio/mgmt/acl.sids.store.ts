import type { PageableDataSource } from "@/types/ag-gird";
import { AbstractPageDataSource } from "@/data/datasource/abstract.page.datasource";
import { defineStore } from "pinia";
import type { AclSidDto } from "@/types/studio/acl";
import { createAclSid , deleteAclSid} from "@/data/studio/mgmt/acl";

type IAclSidsDataSource = PageableDataSource & {
  createSid(sid: string, principal: boolean): Promise<AclSidDto>;
  deleteSid(id: number): Promise<void>;
};

const fetchUrl = "/api/security/acl/admin/sids";
class AclSidsDataSource
  extends AbstractPageDataSource<AclSidDto>
  implements IAclSidsDataSource
{
  constructor() {
    super("data", "totalElements"); // ← 필드명 필요 시 변경 가능
  }

  async createSid(sid: string, principal: boolean): Promise<AclSidDto> {
    const created = await createAclSid({ sid: sid, principal: principal });
    return created;
  }
  async deleteSid(id: number): Promise<void> {
    await deleteAclSid(id);
  }
  getFetchUrl(): string {
    return fetchUrl;
  }
}
export const useAclSidsStore = defineStore(
  "mgmt-security-acl-sids-store",
  () => {
    const dataSource = new AclSidsDataSource();
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
      createSid:dataSource.createSid.bind(dataSource),
      deleteSid:dataSource.deleteSid.bind(dataSource),
    };
  }
);
