import { getFileById } from "@/data/studio/mgmt/files";
import api from "@/plugins/axios";
import { AbstractPageDataSource } from "@/data/datasource/abstract.page.datasource";
import type { PageableDataSource } from "@/types/ag-gird";
import type { AttachmentDto } from "@/types/studio/files";
import type { UploadResult } from "@/types/upload";
import { handleBlobDownloadResponse } from "@/data/http/http-download";
import { defineStore } from "pinia";

// IPageableRoleDataSource를 정의
type IPageableFileDataSource = PageableDataSource & {
  byId(id: number): Promise<AttachmentDto | undefined>;
  deleteById(id: string | number): Promise<void>;
  download(
    data: UploadResult,
    opts?: {
      signal?: AbortSignal; // 취소 지원
      onProgress?: (percent: number) => void; // 진행률 콜백
      download?: boolean; // true면 내부에서 바로 저장
    }
  ): Promise<Blob>;
};

const fetchUrl = "/api/mgmt/files";

class PageableFileDataSource
  extends AbstractPageDataSource
  implements IPageableFileDataSource
{
  async byId(id: number):Promise<AttachmentDto | undefined> {
    const data = await getFileById(id);
    return data;
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

  async download(
    data: UploadResult,
    opts?: {
      signal?: AbortSignal;
      onProgress?: (percent: number) => void;
      download?: boolean;
    }
  ): Promise<Blob> {
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
      loading: dataSource.loading,
      error: dataSource.error,
      dataItems: dataSource.dataItems,
      total: dataSource.total,
      pageSize: dataSource.pageSize,
      page: dataSource.page,
      setPage: dataSource.setPage.bind(dataSource),
      setPageSize: dataSource.setPageSize.bind(dataSource),
      setSearch: dataSource.setSearch.bind(dataSource),
      download: dataSource.download.bind(dataSource),
      setSort: dataSource.setSort.bind(dataSource),
      setFilter: dataSource.setFilter.bind(dataSource),
      byId: dataSource.byId.bind(dataSource),
      deleteById: dataSource.deleteById.bind(dataSource),
      fetch: dataSource.fetch.bind(dataSource),
    };
  }
);
