import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReactPageDataSource } from "@/react/pages/admin/datasource";
import { reactAiApi } from "@/react/pages/ai/api";
import type { AttachmentDto } from "@/types/studio/files";
import { FilesDataSource, ragStatusView } from "./FilesPage";

vi.mock("@/react/pages/ai/api", () => ({
  reactAiApi: {
    getRagObjectIndexStatuses: vi.fn(),
  },
}));

vi.mock("@/react/pages/files/FileDetailDialog", () => ({
  FileDetailDialog: () => null,
}));

vi.mock("@/react/pages/files/FileUploadDialog", () => ({
  FileUploadDialog: () => null,
}));

const file = {
  attachmentId: 3,
  objectType: 1,
  objectId: 2,
  name: "book.epub",
  contentType: "application/epub+zip",
  size: 100,
  createdBy: null,
  createdAt: null,
} satisfies AttachmentDto;

describe("FilesDataSource RAG status", () => {
  beforeEach(() => {
    vi.spyOn(ReactPageDataSource.prototype, "fetchForAgGrid")
      .mockResolvedValue({ rows: [file], total: 1 });
  });

  afterEach(() => vi.restoreAllMocks());

  it("loads one batch for the current file page and merges active progress", async () => {
    vi.mocked(reactAiApi.getRagObjectIndexStatuses).mockResolvedValue([{
      objectType: "attachment",
      objectId: "3",
      jobId: "job-3",
      status: "RUNNING",
      currentStep: "INDEXING",
      progress: 0.4,
      chunkCount: 10,
      embeddedCount: 8,
      indexedCount: 4,
      warningCount: 0,
    }]);
    const onActive = vi.fn();
    const onError = vi.fn();
    const datasource = new FilesDataSource(onActive, onError);

    const result = await datasource.fetchForAgGrid({ startRow: 0, endRow: 15 });

    expect(reactAiApi.getRagObjectIndexStatuses).toHaveBeenCalledWith("attachment", ["3"]);
    expect(result.rows[0].ragIndexStatus?.status).toBe("RUNNING");
    expect(onActive).toHaveBeenCalledWith(true);
    expect(onError).toHaveBeenCalledWith(null);
    expect(ragStatusView("RUNNING", 0.4).label).toBe("색인 중 40%");
  });

  it("keeps files visible when the RAG status batch fails", async () => {
    vi.mocked(reactAiApi.getRagObjectIndexStatuses).mockRejectedValue(new Error("status unavailable"));
    const onActive = vi.fn();
    const onError = vi.fn();
    const datasource = new FilesDataSource(onActive, onError);

    const result = await datasource.fetchForAgGrid({ startRow: 0, endRow: 15 });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].ragIndexStatus?.status).toBe("UNAVAILABLE");
    expect(onActive).toHaveBeenCalledWith(false);
    expect(onError).toHaveBeenCalledWith("네트워크가 연결되지 않았습니다. 연결 확인 후 다시 시도해 주세요.");
  });
});
