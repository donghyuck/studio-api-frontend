import type { SortModelItem } from 'ag-grid-community';
import type { Ref } from 'vue';
type MaybeRef<T> = T | Ref<T>;
interface PageQuery {
  page?: number
  size?: number
  q?: string
}
interface PageableDataSource<T = unknown, R = T> {
  isLoaded: MaybeRef<boolean>
  loading: MaybeRef<boolean>
  error: MaybeRef<unknown | null>
  dataItems: MaybeRef<T[]>
  total: MaybeRef<number>
  pageSize: MaybeRef<number>
  page: MaybeRef<number>
  fetch(query?: PageQuery, options?: FetchOptions): Promise<void>
  setPage(p: number): void
  setPageSize(p: number): void
  setSort(sort?: SortModelItem[]): void
  setSearch(q?: string): void
  setFilter?(q?: string): void
  getReadUrl?(id: string | number): string
  getUpdateUrl?(id: string | number): string
  getDeleteUrl?(id: string | number): string
  read?(id: string | number): Promise<R | undefined>
  update?(...args: any[]): Promise<any>
  remove?(id: string | number): Promise<void>
}
interface PageResult<T> {
  items: T[];          // content
  total: number;       // totalElements
  page: number;        // number (0-based)
  pageSize: number;    // size
  totalPages: number;  // totalPages
  hasNext: boolean;
  hasPrev: boolean;
  sort?: unknown;      // 필요하면 사용
  raw?: unknown;       // 원본 보관(디버깅/레거시 호환)
}

type CachePolicy = 'cache-first' | 'network-first' | 'stale-while-revalidate' | 'no-cache'

interface FetchOptions {
  cachePolicy?: CachePolicy
  ttlMs?: number
  query?: {
    page?: number
    size?: number
    q?: string
    sort?: string
    [k: string]: any
  }
}

type RefreshPolicy = "current" | "first" | "none";

interface CreateOptions {
  /** 목록 새로고침 방식 (기본: 'current') */
  refresh?: RefreshPolicy;
  /** 즉시 UI에 반영할지 (기본: true, 0페이지에서만 prepend) */
  optimistic?: boolean;
}

export type { PageableDataSource, PageResult, PageQuery, RefreshPolicy, CreateOptions, CachePolicy , FetchOptions};
