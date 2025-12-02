import { AbstractPageDataSource } from "@/stores/AbstractPageDataSource";
import type { CreateOptions, PageableDataSource } from "@/types/ag-gird";
import { api } from "@/utils/http";
import { defineStore } from "pinia";

export interface CreateRoleDto {
  name: string;
  description?: string | null;
}

export interface UpdateRoleDto {
  name?: string;
  description?: string | null;
}

export interface RoleDto {
  roleId: number;
  name: string;
  description?: string | null;
  modifiedDate?: string;
  creationDate?: string;
}

export const EMPTY_ROLE: Readonly<RoleDto> = Object.freeze({ roleId: 0, name: "" });


// IPageableRoleDataSource를 정의
type IPageableRoleDataSource = PageableDataSource & {
  create(dto: CreateRoleDto, opts?: CreateOptions): Promise<RoleDto>;
  update(
    id: number,
    dto: UpdateRoleDto,
    opts?: { refreshList?: boolean }
  ): Promise<RoleDto>;
  byId(
    id: number,
    opts?: { revalidate?: boolean; syncList?: boolean }
  ): Promise<RoleDto | undefined>;
  delete(id: number): Promise<void>;
};

const fetchUrl = "/api/mgmt/roles";
class PageableRoleDataSource
  extends AbstractPageDataSource
  implements IPageableRoleDataSource
{
  // 생성자에서 부모 클래스의 생성자를 호출
  // 필요한 경우 contentField와 totalField를 변경.
  // constructor() {
  //   super("data", "totalElements"); // ← 필드명 필요 시 변경 가능
  // }

  private byIdCache: Map<number, { item: RoleDto; ts: number }> = new Map();
  private readonly idKey = "roleId";
  private setCache(item: RoleDto) {
    const id = this.getId(item);
    if (id == null) return;
    this.byIdCache.set(id, { item, ts: Date.now() });
  }
  private getId(item: RoleDto | undefined) {
    return item ? ((item as any)[this.idKey] as number) : undefined;
  }

  // API 엔드포인트 URL을 제공
  getFetchUrl(): string {
    return fetchUrl;
  }

  async byId(
    id: number,
    opts: { revalidate?: boolean; syncList?: boolean } = {}
  ): Promise<RoleDto | undefined> {
    const { revalidate = true, syncList = true } = opts;
    const cached = this.byIdCache.get(id)?.item;
    if (cached && !revalidate) return cached;
    // 2) 서버 재조회
    const payload = await api.get<RoleDto>(`${this.getFetchUrl()}/${id}`);
    this.setCache(payload);
    return payload;
  }

  async create(dto: CreateRoleDto, opts: CreateOptions = {}): Promise<RoleDto> {
    const { refresh = "none", optimistic = true } = opts;
    // 서버 요청
    const created = await api.post<RoleDto>(this.getFetchUrl(), dto);
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

  async update(
    id: number,
    dto: UpdateRoleDto,
    opts: { refreshList?: boolean } = {}
  ): Promise<RoleDto> {
    // PUT/PATCH 중 하나를 선택 (서버에 맞추세요)
    const updated = await api.put<RoleDto>(`${this.getFetchUrl()}/${id}`, dto);
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

export const usePageableRolesStore = defineStore(
  "mgmt-pageable-roles-store",
  () => {
    const dataSource = new PageableRoleDataSource();
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
      byId: dataSource.byId.bind(dataSource),
      update: dataSource.update.bind(dataSource),
      delete: dataSource.delete.bind(dataSource),
    };
  }
);
