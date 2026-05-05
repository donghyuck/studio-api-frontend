import { ReactPageDataSource } from "@/react/pages/admin/datasource";
import type { SortModelItem } from "ag-grid-community";
import type { AttachmentDownloadUrlIssueLogEvent } from "@/react/pages/audit/attachmentDownloadUrlIssueLogsApi";

export class AttachmentDownloadUrlIssueLogsDataSource extends ReactPageDataSource<AttachmentDownloadUrlIssueLogEvent> {
  constructor(private readonly onLoadingChange?: (loading: boolean) => void) {
    super("/api/mgmt/audit/attachment-download-url-issues");
  }

  override async fetch() {
    this.onLoadingChange?.(true);
    try {
      await super.fetch();
    } finally {
      this.onLoadingChange?.(false);
    }
  }

  override async fetchForAgGrid(params: {
    startRow: number;
    endRow: number;
    sortModel?: SortModelItem[];
    filterModel?: Record<string, unknown>;
  }) {
    this.onLoadingChange?.(true);
    try {
      return await super.fetchForAgGrid(params);
    } finally {
      this.onLoadingChange?.(false);
    }
  }
}
