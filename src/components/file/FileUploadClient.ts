import axios from "@/plugins/axios"; // JWT 포함된 axios 인스턴스 사용
import type { UploadMeta, UploadOptions, UploadResult } from "@/types/upload";
export class FileUploadClient {

  private readonly endpoint = "/api/files/upload"; // 업로드 API 엔드포인트

  /**
   * 단일 파일 업로드
   */
  async upload(
    file: File,
    meta: UploadMeta,
    opts: UploadOptions = {}
  ): Promise<UploadResult> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("module", meta.module);
    formData.append("refId", meta.refId);
    if (meta.tag) {
      formData.append("tag", meta.tag);
    }

    const response = await axios.post( "/api/files/upload", formData, {
      signal: opts.signal,
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (e) => {
        if (opts.onProgress && e.total) {
          const percent = Math.round((e.loaded / e.total) * 100);
          opts.onProgress(percent);
        }
      },
    });

    // ✅ 서버 응답에서 data 필드 추출
    const result: UploadResult = response.data.data;
    return result;
  }

  /**
   * 다중 파일 업로드 (동시성 제어 포함)
   */
  async uploadMany(
    files: File[],
    meta: UploadMeta,
    opts: UploadOptions & {
      concurrency?: number;
      onItemProgress?: (index: number, percent: number) => void;
    } = {}
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    const conc = Math.max(1, opts.concurrency ?? 3);

    let index = 0;
    const runNext = async (): Promise<void> => {
      const current = index++;
      if (current >= files.length) return;

      const file = files[current];
      const ac = new AbortController();

      // 외부 취소 시 내부도 취소
      if (opts.signal) {
        const abortHandler = () => ac.abort();
        opts.signal.addEventListener("abort", abortHandler, { once: true });
      }

      const result = await this.upload(file, meta, {
        ...opts,
        signal: ac.signal,
        onProgress: (p) => opts.onItemProgress?.(current, p),
      });

      results[current] = result;
      await runNext();
    };

    const workers = Array.from({ length: Math.min(conc, files.length) }, () =>
      runNext()
    );
    await Promise.all(workers);
    return results;
  }
}
