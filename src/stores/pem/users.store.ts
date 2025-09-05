import { defineStore } from "pinia";
import api from "@/plugins/axios";
import type { PageableDataSource } from "@/types/ag-gird";
import { AbstractPageDataSource } from "@/stores/AbstractPageDataSource";
import { handleBlobDownloadResponse } from "@/utils/http-download";

// IPageableRoleDataSource를 정의
type IPageableUserDataSource = PageableDataSource & {
  downloadExcel(opts?: {
    signal?: AbortSignal; // 취소 지원
    onProgress?: (percent: number) => void; // 진행률 콜백
    download?: boolean; // true면 내부에서 바로 저장
  }): Promise<Blob>;
};

const fetchUrl = "/api/users";

class PageableUserDataSource
  extends AbstractPageDataSource
  implements IPageableUserDataSource
{
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
    const response = await api.get<Blob>(this.getExcelUrl(), {
      responseType: "blob",
      signal,
      onDownloadProgress: (evt) => {
        if (!onProgress) return;
        if (evt.total) {
          onProgress(Math.round((evt.loaded / evt.total) * 100));
        } else {
          onProgress(-1); // 총 길이 미제공: 불확정 진행
        }
      },
    });
    // ✅ 유틸에 AxiosResponse 전체를 전달 (파일명 파싱/저장 처리)
    return handleBlobDownloadResponse(
      response, "users.xlsx", /* autoSave */ download
    );
  }
}

export const usePageableUsersStore = defineStore(
  "mgmt-pageable-users-store",
  () => {
    const dataSource = new PageableUserDataSource();
    return {
      isLoaded: dataSource.isLoaded,
      dataItems: dataSource.dataItems,
      total: dataSource.total,
      pageSize: dataSource.pageSize,
      setPage: dataSource.setPage.bind(dataSource),
      downloadExcel: dataSource.downloadExcel.bind(dataSource),
      setSort: dataSource.setSort.bind(dataSource),
      setFilter: dataSource.setFilter.bind(dataSource),
      fetch: dataSource.fetch.bind(dataSource),
    };
  }
);
