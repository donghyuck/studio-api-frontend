import { defineStore } from "pinia";
import { api } from "@/utils/http";
import type { PageableDataSource, CreateOptions } from "@/types/ag-gird";
import { AbstractPageDataSource } from "@/stores/AbstractPageDataSource";
export interface GroupDto {
  groupId: number;
  name: string;
  description?: string | null;
  properties?: Record<string, any>;
}
export interface CreateGroupDto {
  name: string;
  description?: string | null;
  properties?: Record<string, any>;
}

export interface UpdateGroupDto {
  name: string;
  description?: string | null;
  properties?: Record<string, any>;
}

// IPageableRoleDataSource를 정의
type IPageableGroupDataSource = PageableDataSource & {
  create(dto: CreateGroupDto, opts?: CreateOptions): Promise<GroupDto>;
  update(
    id: number,
    dto: UpdateGroupDto,
    opts?: { refreshList?: boolean }
  ): Promise<GroupDto>;
  byId(
    id: number,
    opts?: { revalidate?: boolean; syncList?: boolean }
  ): Promise<GroupDto | undefined>;
  delete(id: number): Promise<void>;
};

const fetchUrl = "/api/mgmt/groups";
class PageableGroupDataSource
  extends AbstractPageDataSource
  implements IPageableGroupDataSource
{
  private byIdCache: Map<number, { item: GroupDto; ts: number }> = new Map();
  private readonly idKey = "groupId";
  private setCache(item: GroupDto) {
    const id = this.getId(item);
    if (id == null) return;
    this.byIdCache.set(id, { item, ts: Date.now() });
  }
  private getId(item: GroupDto | undefined) {
    return item ? ((item as any)[this.idKey] as number) : undefined;
  }

  getFetchUrl(): string {
    return fetchUrl;
  }

  async create(
    dto: CreateGroupDto,
    opts: CreateOptions = {}
  ): Promise<GroupDto> {
    const { refresh = "none", optimistic = true } = opts;
    // 서버 요청
    const created = await api.post<GroupDto>(this.getFetchUrl(), dto);
    if (optimistic && this.page.value === 0) {
      this.dataItems.value = [created, ...this.dataItems.value];
      this.total.value = (this.total.value ?? 0) + 1;
    }
    // 새로고침 정책
    if (refresh === "current") {
      await this.fetch();
    } else if (refresh === "first") {
      this.setPage(0);
      await this.fetch();
    } // 'none'이면 생략

    return created;
  }

  async byId(
    id: number,
    opts: { revalidate?: boolean; syncList?: boolean } = {}
  ): Promise<GroupDto | undefined> {
    const { revalidate = true, syncList = true } = opts;
    const cached = this.byIdCache.get(id)?.item;
    if (cached && !revalidate) return cached;
    // 2) 서버 재조회
    const payload = await api.get<GroupDto>(`${this.getFetchUrl()}/${id}`);
    this.setCache(payload);
    return payload;
  }

  async update(
    id: number,
    dto: UpdateGroupDto,
    opts: { refreshList?: boolean } = {}
  ): Promise<GroupDto> {
    // PUT/PATCH 중 하나를 선택 (서버에 맞추세요)
    const updated = await api.put<GroupDto>(`${this.getFetchUrl()}/${id}`, dto);
    // 단건 캐시 & 목록 동기화
    this.setCache(updated);
    return updated;
  }

  async delete(id: number): Promise<void> {
    await api.delete(`${this.getFetchUrl()}/${id}`);
    // 삭제 후 목록에서 제거
    this.dataItems.value = this.dataItems.value.filter(
      (item) => this.getId(item) !== id
    );
    this.total.value = (this.total.value ?? 1) - 1;
    this.byIdCache.delete(id);
  }
}

export const usePageableGroupsStore = defineStore(
  "mgmt-pageable-groups-store",
  () => {
    const dataSource = new PageableGroupDataSource();
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
      create: dataSource.create.bind(dataSource),
      update: dataSource.update.bind(dataSource),
      byId: dataSource.byId.bind(dataSource),
      delete: dataSource.delete.bind(dataSource), 
    };
  }
);
