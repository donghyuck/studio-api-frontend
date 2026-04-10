import { ReactPageDataSource } from "@/react/pages/admin/datasource";
import type { LoginFailureEvent } from "@/react/pages/audit/loginFailuresApi";
import type { SortModelItem } from "ag-grid-community";

export class LoginFailuresDataSource extends ReactPageDataSource<LoginFailureEvent> {
  constructor(private readonly onLoadingChange?: (loading: boolean) => void) {
    super("/api/mgmt/audit/login-failure-log");
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
