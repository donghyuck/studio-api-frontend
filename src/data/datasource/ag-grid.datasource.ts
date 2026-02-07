import type { IGetRowsParams, SortModelItem } from "ag-grid-community";
import { ref, type Ref } from "vue";
import { defineStore } from "pinia";
import { api } from "@/data/http";
import { DEFAULT_PAGE_SIZE } from "@/data/studio/public";
import type { FetchOptions, PageQuery, PageableDataSource, PageResult } from "@/types/ag-gird";

type AgGridFilterModel = Record<string, any>;

type CacheEntry<T> = { result: T; ts: number };

type IdGetter<T> = (item: T) => number | string | undefined;

function getFieldValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, part) => acc?.[part], obj);
}

function normalizeAgGridFilterModel(model?: AgGridFilterModel) {
  const params: Record<string, any> = {};
  if (!model || typeof model !== "object") return params;
  for (const [field, value] of Object.entries(model)) {
    if (value == null) continue;
    if (typeof value === "object") {
      if ("filter" in value) {
        params[field] = value.filter;
        continue;
      }
      if ("values" in value) {
        params[field] = value.values;
        continue;
      }
      if ("dateFrom" in value) {
        params[field] = value.dateFrom;
        continue;
      }
    }
    params[field] = value;
  }
  return params;
}

export abstract class AgGridDataSource<T = unknown, R = T>
  implements PageableDataSource<T, R>
{
  constructor(
    protected readonly contentField: string = "content",
    protected readonly totalField: string = "totalElements"
  ) {}

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
  agGridFilterModel = ref<AgGridFilterModel>({});

  private lastRequestKey: string | null = null;
  private byIdCache = new Map<number | string, CacheEntry<T>>();

  setPageSize(newVal: number): void {
    if (newVal !== this.pageSize.value) this.pageSize.value = newVal;
  }

  setPage(newVal: number): void {
    if (this.page.value === newVal) return;
    this.page.value = newVal;
    this.isLoaded.value = false;
  }

  setSort(newValue: SortModelItem[]): void {
    this.sort.value = newValue ?? [];
  }

  setSearch(q?: string): void {
    const trimmed = (q ?? "").trim();
    const next = { ...(this.filter.value ?? {}) } as Record<string, any>;
    if (trimmed.length > 0) {
      next.q = trimmed;
    } else {
      delete next.q;
    }
    this.filter.value = next;
  }

  setFilter(newValue: any): void {
    const excludedKeys = ["page", "size", "sort"];
    if (newValue === null || typeof newValue !== "object" || Array.isArray(newValue)) {
      this.filter.value = {};
      return;
    }
    const entries = Object.entries(newValue);
    const filtered = {} as Record<string, any>;
    for (const [key, value] of entries) {
      if (!excludedKeys.includes(key)) filtered[key] = value;
    }
    this.filter.value = filtered;
  }

  setAgGridSortModel(sortModel?: SortModelItem[]) {
    this.setSort(sortModel ?? []);
  }

  setAgGridFilterModel(filterModel?: AgGridFilterModel) {
    this.agGridFilterModel.value = filterModel ?? {};
    const normalized = normalizeAgGridFilterModel(this.agGridFilterModel.value);
    this.setFilter(normalized);
  }

  applyAgGridRequest(params: {
    startRow: number;
    endRow: number;
    sortModel?: SortModelItem[];
    filterModel?: AgGridFilterModel;
  }) {
    const rawPageSize = params.endRow - params.startRow;
    const pageSize = rawPageSize > 0 ? rawPageSize : this.pageSize.value;
    const page = Math.floor(params.startRow / pageSize);
    this.setPageSize(pageSize);
    this.setPage(page);
    this.setAgGridSortModel(params.sortModel);
    this.setAgGridFilterModel(params.filterModel);
  }

  pageableParams() {
    const pageable = {
      page: this.page.value,
      size: this.pageSize.value,
      sort: this.sortString(),
    };
    return { ...pageable, ...(this.filter.value ?? {}) };
  }

  sortString() {
    if (this.sort.value.length > 0) {
      const field = this.sort.value[0].colId || "";
      const dir = this.sort.value[0].sort || "";
      return `${field},${dir}`;
    }
    return null;
  }

  async fetch(query?: PageQuery, _options?: FetchOptions): Promise<void> {
    this.isLoaded.value = false;
    this.loading.value = true;
    this.error.value = null;
    if (query?.page != null) this.page.value = query.page;
    if (query?.size != null) this.pageSize.value = query.size;
    if (query?.q !== undefined) this.setSearch(query.q);

    try {
      const response = await api.get<any>(this.getFetchUrl(), {
        params: { ...this.pageableParams() },
      });
      if (Array.isArray(response)) {
        this.dataItems.value = response as T[];
        this.total.value = this.dataItems.value.length;
        this.numberOfElements.value = this.dataItems.value.length;
      } else {
        const data = response?.data ?? response;
        const content =
          getFieldValue(data, this.contentField) ??
          getFieldValue(data, "content") ??
          [];
        const total =
          getFieldValue(data, this.totalField) ??
          getFieldValue(data, "totalElements") ??
          0;
        const numberOfElements =
          getFieldValue(data, "numberOfElements") ??
          getFieldValue(data, "data.numberOfElements") ??
          (Array.isArray(content) ? content.length : 0);
        this.dataItems.value = Array.isArray(content) ? content : [];
        this.total.value = Number(total) || 0;
        this.numberOfElements.value = Number(numberOfElements) || 0;
      }
    } catch (error: any) {
      this.error.value = error;
    } finally {
      this.loading.value = false;
      this.isLoaded.value = true;
    }
  }

  async fetchForAgGrid(params: IGetRowsParams) {
    this.applyAgGridRequest({
      startRow: params.startRow,
      endRow: params.endRow,
      sortModel: params.sortModel,
      filterModel: params.filterModel,
    });
    const nextKey = JSON.stringify({
      page: this.page.value,
      size: this.pageSize.value,
      sort: this.sort.value,
      filter: this.filter.value,
    });
    if (this.lastRequestKey === nextKey && this.isLoaded.value) {
      return {
        rows: this.dataItems.value as T[],
        total: this.total.value,
      };
    }
    this.lastRequestKey = nextKey;
    await this.fetch();
    return {
      rows: this.dataItems.value as T[],
      total: this.total.value,
    };
  }

  abstract getFetchUrl(): string;

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

  async update?(id: number | string, payload: Partial<R>): Promise<void> {
    if (!this.getUpdateUrl) {
      throw new Error("update is not configured (getUpdateUrl is missing).");
    }
    await api.put(this.getUpdateUrl(id), payload);
  }

  async remove?(id: number | string): Promise<void> {
    if (!this.getDeleteUrl) {
      throw new Error("remove is not configured (getDeleteUrl is missing).");
    }
    await api.delete(this.getDeleteUrl(id));
  }

  protected cacheById(id: number | string, result: T) {
    this.byIdCache.set(id, { result, ts: Date.now() });
  }

  protected getCachedById(id: number | string, ttlMs = 30_000): T | undefined {
    const hit = this.byIdCache.get(id);
    if (!hit) return undefined;
    if (Date.now() - hit.ts > ttlMs) return undefined;
    return hit.result;
  }

  protected mapResultToPage(items: T[], total: number): PageResult<T> {
    const pageSize = this.pageSize.value;
    const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;
    const page = this.page.value;
    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page + 1 < totalPages,
      hasPrev: page > 0,
      sort: this.sort.value,
      raw: { items, total },
    };
  }
}

export function createAgGridStore<T, R = T>(
  id: string,
  factory: () => AgGridDataSource<T, R>
) {
  return defineStore(id, () => {
    const ds = factory();
    const read = ds.read ? ds.read.bind(ds) : undefined;
    const update = ds.update ? ds.update.bind(ds) : undefined;
    const remove = ds.remove ? ds.remove.bind(ds) : undefined;
    return {
      isLoaded: ds.isLoaded,
      loading: ds.loading,
      error: ds.error,
      dataItems: ds.dataItems,
      total: ds.total,
      pageSize: ds.pageSize,
      page: ds.page,
      setPage: ds.setPage.bind(ds),
      setPageSize: ds.setPageSize.bind(ds),
      setSort: ds.setSort.bind(ds),
      setSearch: ds.setSearch.bind(ds),
      setFilter: ds.setFilter.bind(ds),
      setAgGridSortModel: ds.setAgGridSortModel.bind(ds),
      setAgGridFilterModel: ds.setAgGridFilterModel.bind(ds),
      fetch: ds.fetch.bind(ds),
      fetchForAgGrid: ds.fetchForAgGrid.bind(ds),
      read,
      update,
      remove,
    };
  });
}
