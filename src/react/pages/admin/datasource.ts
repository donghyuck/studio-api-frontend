import type { SortModelItem } from "ag-grid-community";
import type { AgGridCompatibleDataSource } from "@/react/components/ag-grid/types";
import { apiRequest } from "@/react/query/fetcher";
import type { PageResponse } from "@/types/studio/api-common";
import type { UserDto } from "@/types/studio/user";

// 로컬 타입 정의 (stores 의존성 제거)
export interface GroupDto {
  groupId: number;
  name: string;
  description?: string | null;
  memberCount?: number;
  creationDate?: string;
  modifiedDate?: string;
}

export interface RoleDto {
  roleId: number;
  name: string;
  description?: string | null;
  creationDate?: string;
  modifiedDate?: string;
}

function unwrapPageResponse<T>(payload: { data?: PageResponse<T> } | PageResponse<T>) {
  return payload && typeof payload === "object" && "data" in payload && payload.data
    ? (payload.data as PageResponse<T>)
    : (payload as PageResponse<T>);
}

export class ReactPageDataSource<T> implements AgGridCompatibleDataSource<T> {
  // PageableDataSource 인터페이스 충족용 평탄한 값 (readMaybeRef 호환)
  isLoaded = false;
  loading = false;
  error: unknown = null;
  dataItems: T[] = [];
  total = 0;
  pageSize = 20;
  page = 0;

  protected filter: Record<string, unknown> = {};
  protected sort: SortModelItem[] = [];

  constructor(protected readonly fetchUrl: string) {}

  setPage(p: number) {
    this.page = p;
  }
  setPageSize(p: number) {
    this.pageSize = p;
  }
  setSort(s: SortModelItem[]) {
    this.sort = s;
  }
  setSearch(q?: string) {
    const trimmed = (q ?? "").trim();
    if (trimmed) {
      this.filter = { ...this.filter, q: trimmed };
    } else {
      const { q: _q, ...rest } = this.filter;
      this.filter = rest;
    }
  }
  // PageableDataSource 인터페이스 호환 - 문자열 기반 필터
  setFilter(q?: string) {
    this.setSearch(q);
  }
  // Record 기반 필터 적용 (페이지 컴포넌트에서 사용)
  applyFilter(f: Record<string, unknown>) {
    this.filter = f ?? {};
  }

  async fetch() {
    this.loading = true;
    try {
      const sort =
        this.sort.length > 0
          ? `${this.sort[0].colId},${this.sort[0].sort}`
          : undefined;
      const payload = await apiRequest<
        { data?: PageResponse<T> } | PageResponse<T>
      >("get", this.fetchUrl, {
        params: { page: this.page, size: this.pageSize, sort, ...this.filter },
      });
      const page = unwrapPageResponse(payload);
      this.dataItems = page.content ?? [];
      this.total = page.totalElements ?? 0;
      this.isLoaded = true;
    } catch (err) {
      this.error = err;
      throw err;
    } finally {
      this.loading = false;
    }
  }

  async fetchForAgGrid({
    startRow,
    endRow,
    sortModel,
    filterModel,
  }: {
    startRow: number;
    endRow: number;
    sortModel?: SortModelItem[];
    filterModel?: Record<string, unknown>;
  }) {
    const size = endRow - startRow || this.pageSize;
    const page = Math.floor(startRow / size);
    const sort =
      (sortModel ?? []).length > 0
        ? `${sortModel![0].colId},${sortModel![0].sort}`
        : undefined;

    const agFilter: Record<string, unknown> = {};
    if (filterModel) {
      for (const [key, val] of Object.entries(filterModel)) {
        if (val && typeof val === "object" && "filter" in val) {
          agFilter[key] = (val as Record<string, unknown>).filter;
        }
      }
    }

    const params = { page, size, sort, ...this.filter, ...agFilter };

    const payload = await apiRequest<
      { data?: PageResponse<T> } | PageResponse<T>
    >("get", this.fetchUrl, { params });
    const pageData = unwrapPageResponse(payload);

    return {
      rows: pageData.content ?? [],
      total: pageData.totalElements ?? 0,
    };
  }
}

export class UsersDataSource extends ReactPageDataSource<UserDto> {
  constructor() {
    super("/api/mgmt/users");
  }
}

export class GroupsDataSource extends ReactPageDataSource<GroupDto> {
  constructor() {
    super("/api/mgmt/groups");
  }
}

export class RolesDataSource extends ReactPageDataSource<RoleDto> {
  constructor() {
    super("/api/mgmt/roles");
  }
}
