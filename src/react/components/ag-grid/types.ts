import type {
  ColDef,
  GridOptions,
  RowSelectionOptions,
  RowModelType,
  SortModelItem,
} from "ag-grid-community";
import type { PageableDataSource } from "@/types/ag-grid";

export interface GridEventListener {
  type: string;
  listener: (event: unknown) => void;
}

export interface GridContentProps<TData = unknown> {
  columns?: ColDef<TData>[];
  options?: GridOptions<TData>;
  events?: GridEventListener[];
  rowSelection?: RowSelectionOptions<TData> | "single" | "multiple";
  rowData: TData[];
  loading?: boolean;
  autoResize?: boolean;
  height?: number;
  onFilterActived?: (active: boolean) => void;
  onRowSelected?: (event: unknown) => void;
}

export interface PageableGridContentProps<TData = unknown> {
  columns?: ColDef<TData>[];
  options?: GridOptions<TData>;
  events?: GridEventListener[];
  rowModelType?: RowModelType;
  rowSelection?: RowSelectionOptions<TData> | "single" | "multiple";
  datasource: PageableDataSource<TData>;
  colIdToSnakeCase?: boolean;
  height?: number;
  onFilterActived?: (active: boolean) => void;
}

export interface GridContentHandle<TData = unknown> {
  refresh: () => void;
  clearFilters: () => void;
  selectedRows: () => TData[];
  displayedRowCount: () => number;
  reserveScrollTo: (last?: number) => void;
  loading: (loading?: boolean) => void;
}

export interface PageableGridContentHandle<TData = unknown> {
  refresh: () => void;
  clearFilters: () => void;
  selectedRows: () => TData[];
  selectAll: () => void;
  deselectAll: () => void;
  displayedRowCount: () => number;
  goToPreviousPage: () => void;
}

export interface AgGridFetchResult<TData> {
  rows: TData[];
  total: number;
}

export interface AgGridCompatibleDataSource<TData = unknown>
  extends PageableDataSource<TData> {
  fetchForAgGrid?: (params: {
    startRow: number;
    endRow: number;
    sortModel?: SortModelItem[];
    filterModel?: Record<string, unknown>;
  }) => Promise<AgGridFetchResult<TData>>;
}
