import api from "@/plugins/axios";
import type { PageableDataSource, PageResult } from "@/types/ag-gird";
import type { SortModelItem } from "ag-grid-community";
import type { Ref } from "vue";
import { ref } from "vue";

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

export abstract class AbstractPageDataSource implements PageableDataSource {
  constructor(
    protected readonly contentField: string = "data.content",
    protected readonly totalField: string = "data.totalElements"
  ) {}

  // 공통 상태 정의
  isLoaded= ref<boolean>(false);
  dataItems = ref<[]>([]);
  total = ref(0);
  numberOfElements: Ref<number> = ref(0);
  page = ref<number>(0);
  pageSize: Ref<number> = ref<number>(15);
  sort: Ref<SortModelItem[]> = ref<SortModelItem[]>([]);
  filter: any = ref({});

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
  async fetch(): Promise<void> {
    this.isLoaded.value = false; // 로딩 상태 초기화
    try {
      let response = await api.get(this.getFetchUrl(), {
        params: { ...this.pageable_params() },
      });
      // 공통 처리 로직
      const data = response.data;
      this.dataItems.value = getFieldValue(data, this.contentField) || [];
      this.total.value = getFieldValue(data, this.totalField) || 0;
      this.numberOfElements.value = getFieldValue(data, "data.numberOfElements") || 0;
    //} catch (error: any) {
      // 에러 처리
    }finally{
      this.isLoaded.value = true;
    }
  }
  // 추상 메서드: 하위 클래스에서 반드시 구현해야 함
  abstract getFetchUrl(): string;
}
