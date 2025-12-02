import { createAclEntry, deleteAclEntry } from "@/data/studio/acl";
import type { PageableDataSource } from "@/types/ag-gird";
import type { AclEntryDto, AclEntryRequest } from "@/types/studio/acl";
import { defineStore } from "pinia";
import { AbstractPageDataSource } from "../AbstractPageDataSource";

type IAclEntriesDataSource = PageableDataSource & {
  createEntry(req: AclEntryRequest): Promise<AclEntryDto>;
};

const fetchUrl = "/api/security/acl/admin/entries";
class AclEntriesDataSource
  extends AbstractPageDataSource
  implements IAclEntriesDataSource
{
  constructor() {
    super("data", "totalElements"); // ← 필드명 필요 시 변경 가능
  }

  getFetchUrl(): string {
    return fetchUrl;
  }
  async createEntry(payload: AclEntryRequest): Promise<AclEntryDto> {
    const created = await createAclEntry(payload);
    return created;
  }
  async deleteEntry(id: number): Promise<void> {
    await deleteAclEntry(id);
  }
}
export const useAclEntriesStore = defineStore(
  "mgmt-security-acl-entries-store",
  () => {
    const dataSource = new AclEntriesDataSource();
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
      createEntry: dataSource.createEntry.bind(dataSource),
      deleteEntry: dataSource.deleteEntry.bind(dataSource),
    };
  }
);
