import { DEFAULT_PAGE_SIZE } from "@/data/studio/public";
import { api } from "@/data/http";
import type { FetchOptions, PageQuery, PageableDataSource, PageResult } from "@/types/ag-gird";
import type { SortModelItem } from "ag-grid-community";
import { ref, type Ref } from "vue";

type IdGetter<T> = (item: T) => number | string | undefined;
interface ByIdOptions {
  revalidate?: boolean; // 기본 true (SWR)
  ttlMs?: number; // 기본 30s
  syncList?: boolean; // 목록에도 반영할지(기본 true)
}

type CacheEntry<T> = { result: PageResult<T>; ts: number };

function getFieldValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, part) => acc?.[part], obj);
}

export abstract class AbstractPageDataSource<T = unknown, R = T>
  implements PageableDataSource<T, R> {
  constructor(
    protected readonly contentField: string = "content",
    protected readonly totalField: string = "totalElements"
  ) {}

  // 공통 상태 정의
  isLoaded = ref(false);
  loading = ref(false);
  error = ref<unknown | null>(null);
  dataItems = ref<T[]>([]) as Ref<T[]>;
  total = ref(0);
  numberOfElements = ref(0);
  page = ref(0);
  pageSize = ref(DEFAULT_PAGE_SIZE);
  sort = ref<SortModelItem[]>([]);
  filter = ref<Record<string, any>>({});

  setPageSize(newVal: number): void {
    if (newVal != this.pageSize.value) this.pageSize.value = newVal;
  }

  // 공통 메서드 구현
  setPage(newVal: number): void { 
    if (this.page.value === newVal) return;
    this.page.value = newVal;
    this.isLoaded.value = false; 
  }

  getPage():number{
    return this.page.value;
  }

  setSort(newValue: SortModelItem[]): void {
    this.sort.value = newValue;
  }

  setSearch(q?: string): void {
    const trimmed = (q ?? "").trim();
    const next = { ...(this.filter.value ?? {}) };
    if (trimmed.length > 0) {
      next.q = trimmed;
    } else {
      delete next.q;
    }
    this.filter.value = next;
  }

  setFilter(newValue: any): void {
    const excludedKeys = ["page", "size", "sort"];
    if (
      newValue === null ||
      typeof newValue !== "object" ||
      Array.isArray(newValue)
    ) {
      console.warn(
        "setFilter: 입력값이 null이거나 유효한 객체가 아닙니다. 빈 객체로 대체합니다."
      );
      this.filter.value = {};
      return;
    }
    const entries = Object.entries(newValue);
    const filtered = {} as Record<string, any>;
    for (const [key, value] of entries) {
      if (excludedKeys.includes(key)) {
        console.warn(`setFilter: '${key}' 필드는 무시됩니다.`);
      } else {
        filtered[key] = value;
      }
    }
    this.filter.value = filtered;
  }

  pageable_params() {
    var pageable = {
      page: this.page.value,
      size: this.pageSize.value,
      sort: this.sort_string(),
    };
    if (this.is_plain_object(this.filter))
      return { ...pageable, ...this.filter.value };
    else {
      console.log("only plain object apply to filter...");
      return pageable;
    }
  }

  is_plain_object(b: any): boolean {
    return typeof b === "object" && b !== null && !Array.isArray(b);
  }

  sort_string() {
    if (this.sort.value.length > 0) {
      const field = this.sort_field() || "";
      const dir = this.sort_dir() || "";
      return `${field},${dir}`;
    }
    return null;
  }

  sort_field() {
    if (this.sort.value.length > 0) {
      return this.sort.value[0].colId;
    }
    return null;
  }

  sort_dir() {
    if (this.sort.value.length > 0) {
      return this.sort.value[0].sort;
    }
    return null;
  }

  /**
   * 데이터를 가져오는 메서드
   * fetch 에서 호출하는 endpoint.
   */
  async fetch(query?: PageQuery, _options?: FetchOptions): Promise<void> {
    this.isLoaded.value = false;
    this.loading.value = true;
    this.error.value = null;
    if (query?.page != null) this.page.value = query.page;
    if (query?.size != null) this.pageSize.value = query.size;
    if (query?.q !== undefined) this.setSearch(query.q);
    try {
      const response = await api.get<any>(this.getFetchUrl(), {
        params: { ...this.pageable_params() },
      });
      const data = response?.data ?? response;
      const normalized = (data?.data ?? data) ?? {};
      const content =
        getFieldValue(normalized, this.contentField) ??
        getFieldValue(normalized, "content") ??
        getFieldValue(normalized, "data.content") ??
        (Array.isArray(normalized) ? normalized : []);
      const total =
        getFieldValue(normalized, this.totalField) ??
        getFieldValue(normalized, "totalElements") ??
        getFieldValue(normalized, "data.totalElements") ??
        (Array.isArray(normalized) ? normalized.length : 0);
      const numberOfElements =
        getFieldValue(data, "numberOfElements") ??
        getFieldValue(data, "data.numberOfElements") ??
        (Array.isArray(content) ? content.length : 0);
      this.dataItems.value = Array.isArray(content) ? content : [];
      this.total.value = Number(total) || 0;
      this.numberOfElements.value = Number(numberOfElements) || 0;
    } catch (error: any) {
      this.error.value = error;
    } finally {
      this.loading.value = false;
      this.isLoaded.value = true;
    }
  }

  getReadUrl?(id: number | string): string;
  getUpdateUrl?(id: number | string): string;
  getDeleteUrl?(id: number | string): string;

  async read?(id: number | string): Promise<R | undefined> {
    if (!this.getReadUrl) {
      throw new Error("read is not configured (getReadUrl is missing).");
    }
    const response = await api.get<R>(this.getReadUrl(id));
    return (response as any)?.data ?? response;
  }

  async update?(...args: any[]): Promise<any> {
    const [id, payload] = args;
    if (!this.getUpdateUrl) {
      throw new Error("update is not configured (getUpdateUrl is missing).");
    }
    return api.put(this.getUpdateUrl(id), payload);
  }

  async remove?(id: number | string): Promise<void> {
    if (!this.getDeleteUrl) {
      throw new Error("remove is not configured (getDeleteUrl is missing).");
    }
    await api.delete(this.getDeleteUrl(id));
  }
  // 추상 메서드: 하위 클래스에서 반드시 구현해야 함
  abstract getFetchUrl(): string;
}
