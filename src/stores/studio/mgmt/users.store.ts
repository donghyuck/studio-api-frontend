import { defineStore } from "pinia";
import { api as httpApi } from "@/data/http";
import axios from "@/plugins/axios";
import type { AxiosProgressEvent, AxiosResponse } from "axios";
import type { PageableDataSource } from "@/types/ag-gird";
import { AbstractPageDataSource } from "@/data/datasource/abstract.page.datasource";
import { handleBlobDownloadResponse } from "@/data/http/http-download";
import type { ResetPasswordRequest, UserDto } from "@/types/studio/user";
export type { UserDto } from "@/types/studio/user";
import { resetPassword } from "@/data/studio/mgmt/user";

// IPageableRoleDataSource를 정의
type IPageableUserDataSource = PageableDataSource & {
  downloadExcel(opts?: {
    signal?: AbortSignal; // 취소 지원
    onProgress?: (percent: number) => void; // 진행률 콜백
    download?: boolean; // true면 내부에서 바로 저장
  }): Promise<Blob>;
  update(
    id: number,
    dto: UserDto,
    opts?: { refreshList?: boolean }
  ): Promise<UserDto>;
  byId(
    id: number,
    opts?: { revalidate?: boolean; syncList?: boolean }
  ): Promise<UserDto | undefined>;

  resetPassword( id : number, payload:ResetPasswordRequest) :Promise<void>
  
  delete(id: number): Promise<void>; 
};

const fetchUrl = "/api/mgmt/users";

class PageableUserDataSource
  extends AbstractPageDataSource<UserDto>
  implements IPageableUserDataSource
{
  
  private byIdCache: Map<number, { item: UserDto; ts: number }> = new Map();

  private readonly idKey = "userId";
  
  private setCache(item: UserDto) {
    const id = this.getId(item);
    if (id == null) return;
    this.byIdCache.set(id, { item, ts: Date.now() });
  }

  private getId(item: UserDto | undefined) {
    return item ? ((item as any)[this.idKey] as number) : undefined;
  }

  async byId(
    id: number,
    opts: { revalidate?: boolean; syncList?: boolean } = {}
  ): Promise<UserDto | undefined> {
    const { revalidate = true, syncList = true } = opts;
    const cached = this.byIdCache.get(id)?.item;
    if (cached && !revalidate) return cached;
    // 2) 서버 재조회
    const payload = await httpApi.get<UserDto>(`${this.getFetchUrl()}/${id}`);
    this.setCache(payload);
    return payload;
  }

    async update(
      id: number,
      dto: UserDto,
      opts: { refreshList?: boolean } = {}
    ): Promise<UserDto> {
      // PUT/PATCH 중 하나를 선택 (서버에 맞추세요)
      const updated = await httpApi.put<UserDto>(`${this.getFetchUrl()}/${id}`, dto);
      // 단건 캐시 & 목록 동기화
      this.setCache(updated);
      return updated;
    }

    async resetPassword(id: number, payload: ResetPasswordRequest): Promise<void> {
        await resetPassword(id, payload)
    }

  async delete(id: number): Promise<void> {
    await httpApi.delete(`${this.getFetchUrl()}/${id}`);
    // 삭제 후 목록에서 제거
    this.dataItems.value = this.dataItems.value.filter(
      (item) => this.getId(item) !== id
    );
    this.total.value = (this.total.value ?? 1) - 1;
    this.byIdCache.delete(id);
  }

  // API 엔드포인트 URL을 제공
  getFetchUrl(): string {
    return fetchUrl;
  }

  private getExcelUrl(): string {
    return `${this.getFetchUrl()}/excel:fixed`;
  }

  async downloadExcel(opts?: {
    signal?: AbortSignal;
    onProgress?: (percent: number) => void;
    download?: boolean;
  }): Promise<Blob> {
    const { signal, onProgress, download = false } = opts ?? {};
    const response = (await axios.get<Blob>(this.getExcelUrl(), {
      responseType: "blob",
      signal,
      onDownloadProgress: (evt: AxiosProgressEvent) => {
        if (!onProgress) return;
        if (evt.total) {
          onProgress(Math.round((evt.loaded / evt.total) * 100));
        } else {
          onProgress(-1); // 총 길이 미제공: 불확정 진행
        }
      },
    })) as AxiosResponse<Blob>;
    // ✅ 유틸에 AxiosResponse 전체를 전달 (파일명 파싱/저장 처리)
    return handleBlobDownloadResponse(
      response,
      "users.xlsx",
      /* autoSave */ download
    );
  }
}

export const usePageableUsersStore = defineStore(
  "mgmt-pageable-users-store",
  () => {
    const dataSource = new PageableUserDataSource();
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
      setPage: dataSource.setPage.bind(dataSource),
      downloadExcel: dataSource.downloadExcel.bind(dataSource),
      setSort: dataSource.setSort.bind(dataSource),
      setFilter: dataSource.setFilter.bind(dataSource),
      fetch: dataSource.fetch.bind(dataSource),
      byId: dataSource.byId.bind(dataSource),
      delete: dataSource.delete.bind(dataSource), 
      update: dataSource.update.bind(dataSource),
      resetPassword: dataSource.resetPassword.bind(dataSource), 
    };
  }
);
