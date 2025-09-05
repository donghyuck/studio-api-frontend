import api from "@/plugins/axios";
import { AbstractPageDataSource } from "@/stores/AbstractPageDataSource";
import type { PageableDataSource } from "@/types/ag-gird";
import type { UploadResult } from "@/types/upload";
import { handleBlobDownloadResponse } from "@/utils/http-download";
import { defineStore } from "pinia";

// IPageableRoleDataSource를 정의
type IPageableFileDataSource = PageableDataSource & {
  
  deleteById(id: string | number): Promise<void>;

  download(
    data: UploadResult,
    opts?: {
    signal?: AbortSignal; // 취소 지원
    onProgress?: (percent: number) => void; // 진행률 콜백
    download?: boolean; // true면 내부에서 바로 저장
  }): Promise<Blob>;
};

const fetchUrl = "/api/files";

class PageableFileDataSource
  extends AbstractPageDataSource
  implements IPageableFileDataSource
{
  constructor() {
    super("data", "totalElements"); // ← 필드명 필요 시 변경 가능
  }
  
  // API 엔드포인트 URL을 제공
  getFetchUrl(): string {
    return fetchUrl;
  }

    /** ID 기반 삭제 수행 */
  async deleteById(id: string | number): Promise<void> {
    await api.delete(`${this.getFetchUrl()}/${id}`);
  }

  /** ID 기반 다운로드 URL */
  private getDownloadUrl(id: string | number): string {
    return `${this.getFetchUrl()}/${id}/download`;
  }

  async download (
    data: UploadResult,
    opts?: {
    signal?: AbortSignal;
    onProgress?: (percent: number) => void;
    download?: boolean;
  }): Promise<Blob> {
    const { signal, onProgress, download = false } = opts ?? {};
    const response = await api.get<Blob>(this.getDownloadUrl(data.id), {
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
      response,
      data.originalName,
      /* autoSave */ download
    );
  }
}

export const usePageableFilesStore = defineStore(
  "mgmt-pageable-files-store",
  () => {
    const dataSource = new PageableFileDataSource();
    return {
      isLoaded: dataSource.isLoaded,
      dataItems: dataSource.dataItems,
      total: dataSource.total,
      pageSize: dataSource.pageSize,
      setPage: dataSource.setPage.bind(dataSource),
      download: dataSource.download.bind(dataSource),
      setSort: dataSource.setSort.bind(dataSource),
      setFilter: dataSource.setFilter.bind(dataSource),
      deleteById: dataSource.deleteById.bind(dataSource),
      fetch: dataSource.fetch.bind(dataSource),
    };
  }
);
