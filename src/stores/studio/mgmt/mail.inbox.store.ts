import { AbstractPageDataSource } from "@/data/datasource/abstract.page.datasource";
import type { PageableDataSource } from "@/types/ag-gird";
import type { MailMessageDto } from "@/types/studio/mail";
import { api } from "@/data/http";
import { defineStore } from "pinia";

type IPageableMailInboxDataSource = PageableDataSource & {
  byId(id: number): Promise<MailMessageDto | undefined>;
}

const fetchUrl = "/api/mgmt/mail";

class PageableMailInboxDataSource
  extends AbstractPageDataSource
  implements IPageableMailInboxDataSource
{
    async byId(id: number): Promise<MailMessageDto | undefined> {
        const cached = (this.dataItems.value as MailMessageDto[]).find(
          (item) => item.mailId === id
        );
        if (cached) return cached;
        const payload = await api.get<MailMessageDto>(`${this.getFetchUrl()}/${id}`);
        return payload;
    }

    getFetchUrl(): string {
        return fetchUrl ;
    }
}
export const usePageableMailInboxStore = defineStore(
  "mgmt-pageable-mail-inbox-store",
  () => {
    const dataSource = new PageableMailInboxDataSource();
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
      byId: dataSource.byId.bind(dataSource),
    };
  }
);
