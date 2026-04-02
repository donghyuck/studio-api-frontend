import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ColDef,
  GridApi,
  GridOptions,
  GridReadyEvent,
  IGetRowsParams,
  PaginationChangedEvent,
  SelectionChangedEvent,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { toast } from "@/react/feedback";
import { defaultGridOptions } from "@/react/components/ag-grid/gridOptions";
import type {
  AgGridCompatibleDataSource,
  PageableGridContentHandle,
  PageableGridContentProps,
} from "@/react/components/ag-grid/types";
import {
  getAutoGridHeight,
  readMaybeRef,
  selectViewportRows,
} from "@/react/components/ag-grid/utils";
import { resolveAxiosError } from "@/utils/helpers";
import "@/react/components/ag-grid/styles.css";

function toSnakeCase(value: string, enabled?: boolean) {
  if (!enabled) {
    return value;
  }

  return value.replace(/([A-Z])/g, "_$1").toLowerCase();
}

function PageableGridContentInner<TData = unknown>(
  {
    columns,
    options,
    events,
    rowModelType,
    datasource,
    colIdToSnakeCase,
    height,
    onFilterActived,
  }: PageableGridContentProps<TData>,
  ref: React.ForwardedRef<PageableGridContentHandle<TData>>
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gridApiRef = useRef<GridApi<TData> | null>(null);
  const [gridHeight, setGridHeight] = useState(height ?? 400);
  const [selectedItems, setSelectedItems] = useState<TData[]>([]);
  const [pageSize, setPageSize] = useState(
    readMaybeRef(datasource.pageSize, 15)
  );

  const shouldAutoResize = height == null;
  const effectiveRowModelType = rowModelType ?? "infinite";
  const gridOptions = useMemo<GridOptions<TData>>(
    () => ({ ...defaultGridOptions, ...options }),
    [options]
  );

  const columnDefs = useMemo<ColDef<TData>[]>(
    () =>
      (columns ?? []).map((column) => ({
        ...column,
        colId: toSnakeCase(column.field ?? "", colIdToSnakeCase),
      })),
    [colIdToSnakeCase, columns]
  );

  const resizeGrid = useCallback(() => {
    if (!containerRef.current) {
      return;
    }

    setGridHeight(getAutoGridHeight(containerRef.current));
    gridApiRef.current?.sizeColumnsToFit();
  }, []);

  const getRows = useCallback(
    async (params: IGetRowsParams<TData>) => {
      const activeFilters = Object.keys(params.filterModel ?? {}).length > 0;
      onFilterActived?.(activeFilters);

      try {
        const agGridDatasource = datasource as AgGridCompatibleDataSource<TData>;

        if (agGridDatasource.fetchForAgGrid) {
          const result = await agGridDatasource.fetchForAgGrid({
            startRow: params.startRow,
            endRow: params.endRow,
            sortModel: params.sortModel,
            filterModel: params.filterModel as Record<string, unknown>,
          });
          params.successCallback(result.rows, result.total);
          return;
        }

        const nextPageSize = params.endRow - params.startRow || pageSize;
        datasource.setPageSize(nextPageSize);
        datasource.setSort(params.sortModel);
        datasource.setPage(Math.floor(params.startRow / nextPageSize));
        await datasource.fetch();

        params.successCallback(
          readMaybeRef(datasource.dataItems, [] as TData[]),
          readMaybeRef(datasource.total, 0)
        );
      } catch (error) {
        toast.error(resolveAxiosError(error));
        params.failCallback();
      }
    },
    [datasource, onFilterActived, pageSize]
  );

  const handleGridReady = useCallback(
    (event: GridReadyEvent<TData>) => {
      gridApiRef.current = event.api;
      event.api.setGridOption("datasource", { getRows });
      events?.forEach((listener) =>
        event.api.addEventListener(
          listener.type as Parameters<typeof event.api.addEventListener>[0],
          listener.listener as Parameters<typeof event.api.addEventListener>[1]
        )
      );

      if (shouldAutoResize) {
        resizeGrid();
      }
    },
    [events, getRows, resizeGrid, shouldAutoResize]
  );

  const handlePaginationChanged = useCallback(
    (event: PaginationChangedEvent<TData>) => {
      if (!event.newPageSize) {
        return;
      }

      const nextPageSize = event.api.paginationGetPageSize();
      setPageSize(nextPageSize);
      datasource.setPageSize(nextPageSize);
    },
    [datasource]
  );

  const handleSelectionChanged = useCallback(
    (event: SelectionChangedEvent<TData>) => {
      setSelectedItems(event.api.getSelectedRows());
    },
    []
  );

  useEffect(() => {
    if (!shouldAutoResize) {
      return;
    }

    resizeGrid();
    window.addEventListener("resize", resizeGrid);

    return () => {
      window.removeEventListener("resize", resizeGrid);
    };
  }, [resizeGrid, shouldAutoResize]);

  useImperativeHandle(
    ref,
    () => ({
      refresh: () => {
        gridApiRef.current?.refreshInfiniteCache();
      },
      clearFilters: () => {
        gridApiRef.current?.setFilterModel(null);
        gridApiRef.current?.onFilterChanged();
      },
      selectedRows: () => selectedItems,
      selectAll: () => {
        if (gridApiRef.current) {
          selectViewportRows(gridApiRef.current, true);
        }
      },
      deselectAll: () => {
        gridApiRef.current?.deselectAll();
      },
      displayedRowCount: () => gridApiRef.current?.getDisplayedRowCount() ?? 0,
      goToPreviousPage: () => {
        const previousPage = readMaybeRef(datasource.page, 0);

        if (previousPage > 0) {
          window.setTimeout(() => {
            gridApiRef.current?.paginationGoToPage(previousPage);
          }, 50);
        }
      },
    }),
    [datasource.page, selectedItems]
  );

  return (
    <div
      ref={containerRef}
      className="ag-theme-material react-grid-host"
      style={{ width: "100%", height: gridHeight }}
    >
      <AgGridReact<TData>
        rowModelType={effectiveRowModelType}
        gridOptions={gridOptions}
        columnDefs={columnDefs}
        pagination
        paginationPageSize={pageSize}
        cacheBlockSize={pageSize}
        onPaginationChanged={handlePaginationChanged}
        onSelectionChanged={handleSelectionChanged}
        onGridReady={handleGridReady}
      />
    </div>
  );
}

export const PageableGridContent = forwardRef(
  PageableGridContentInner
) as <TData = unknown>(
  props: PageableGridContentProps<TData> & {
    ref?: React.ForwardedRef<PageableGridContentHandle<TData>>;
  }
) => React.ReactElement;
