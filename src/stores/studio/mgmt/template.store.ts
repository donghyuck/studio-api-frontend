import { AbstractPageDataSource } from "@/data/datasource/abstract.page.datasource";
import type { PageableDataSource } from "@/types/ag-gird";
import type { MailMessageDto } from "@/types/studio/mail";
import type { TemplateDto } from "@/types/studio/template";
import { api } from "@/data/http";
import { defineStore } from "pinia";

type IPageableTemplateDataSource = PageableDataSource & {
  byId(id: number, force?: boolean): Promise<TemplateDto | undefined>;
}

const fetchUrl = "/api/mgmt/templates";

class PageableTemplateDataSource
  extends AbstractPageDataSource
  implements IPageableTemplateDataSource
{
    private readonly byIdCache = new Map<number, TemplateDto>();

    async byId(id: number, force: boolean = false): Promise<TemplateDto | undefined> {
        if (!force) {
            const cached = this.byIdCache.get(id);
            if (cached) return cached;

            const listItem = (this.dataItems.value as TemplateDto[]).find((item) => item.templateId === id);
            if (listItem) {
                this.byIdCache.set(id, listItem);
                return listItem;
            }
        }
        const payload = await api.get<TemplateDto>(`${this.getFetchUrl()}/${id}`);
        if (payload) {
            this.byIdCache.set(id, payload);
        }
        return payload;
    }

    getFetchUrl(): string {
        return fetchUrl ;
    }
}
export const usePageableTemplateStore = defineStore(
  "mgmt-pageable-template-store",
  () => {
    const dataSource = new PageableTemplateDataSource();
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
