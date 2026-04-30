import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTheme } from "@mui/material/styles";
import type {
  ColDef,
  FilterChangedEvent,
  GridApi,
  GridOptions,
  GridReadyEvent,
  SelectionChangedEvent,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { defaultGridOptions } from "@/react/components/ag-grid/gridOptions";
import { createAgGridTheme } from "@/react/components/ag-grid/theme";
import type {
  GridContentHandle,
  GridContentProps,
} from "@/react/components/ag-grid/types";
import {
  getAutoGridHeight,
  normalizeRowSelection,
} from "@/react/components/ag-grid/utils";
import "@/react/components/ag-grid/styles.css";

function GridContentInner<TData = unknown>(
  {
    columns,
    options,
    events,
    rowSelection,
    rowData,
    loading,
    autoResize,
    height,
    onFilterActived,
    onRowSelected,
  }: GridContentProps<TData>,
  ref: React.ForwardedRef<GridContentHandle<TData>>
) {
  const muiTheme = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gridApiRef = useRef<GridApi<TData> | null>(null);
  const reservedScrollIndexRef = useRef(0);
  const [gridHeight, setGridHeight] = useState(height ?? 400);
  const [selectedItems, setSelectedItems] = useState<TData[]>([]);

  const shouldAutoResize = autoResize || height == null;
  const gridOptions = useMemo<GridOptions<TData>>(
    () => ({ ...defaultGridOptions, ...options }),
    [options]
  );
  const columnDefs = useMemo<ColDef<TData>[]>(() => columns ?? [], [columns]);
  const normalizedRowSelection = useMemo(
    () => normalizeRowSelection(rowSelection),
    [rowSelection]
  );
  const agGridTheme = useMemo(() => createAgGridTheme(muiTheme), [muiTheme]);

  const resizeGrid = useCallback(() => {
    if (!containerRef.current) {
      return;
    }

    setGridHeight(getAutoGridHeight(containerRef.current));
  }, []);

  const handleGridReady = useCallback(
    (event: GridReadyEvent<TData>) => {
      gridApiRef.current = event.api;
      events?.forEach((listener) =>
        event.api.addEventListener(
          listener.type as Parameters<typeof event.api.addEventListener>[0],
          listener.listener as Parameters<typeof event.api.addEventListener>[1]
        )
      );

      onFilterActived?.(event.api.isAnyFilterPresent());

      if (shouldAutoResize) {
        resizeGrid();
      }
    },
    [events, onFilterActived, resizeGrid, shouldAutoResize]
  );

  const handleSelectionChanged = useCallback(
    (event: SelectionChangedEvent<TData>) => {
      setSelectedItems(event.api.getSelectedRows());
    },
    []
  );

  const handleFilterChanged = useCallback(
    (event: FilterChangedEvent<TData>) => {
      onFilterActived?.(event.api.isAnyFilterPresent());
    },
    [onFilterActived]
  );

  useEffect(() => {
    if (reservedScrollIndexRef.current <= 0) {
      return;
    }

    gridApiRef.current?.ensureIndexVisible(reservedScrollIndexRef.current, "middle");
    reservedScrollIndexRef.current = -1;
  }, [rowData]);

  useEffect(() => {
    gridApiRef.current?.setGridOption("loading", Boolean(loading));
  }, [loading]);

  useEffect(() => {
    const gridApi = gridApiRef.current;
    if (!gridApi) {
      return;
    }

    if (loading) {
      gridApi.hideOverlay();
      return;
    }

    if (rowData.length > 0) {
      gridApi.hideOverlay();
    } else {
      gridApi.showNoRowsOverlay();
    }
  }, [loading, rowData]);

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
        gridApiRef.current?.refreshCells({ force: true });
      },
      clearFilters: () => {
        gridApiRef.current?.setFilterModel(null);
        gridApiRef.current?.onFilterChanged();
      },
      selectedRows: () => selectedItems,
      displayedRowCount: () => gridApiRef.current?.getDisplayedRowCount() ?? 0,
      reserveScrollTo: (last = 0) => {
        if (last > 0) {
          reservedScrollIndexRef.current = last;
        }
      },
      loading: (loading = false) => {
        gridApiRef.current?.setGridOption("loading", loading);
      },
    }),
    [selectedItems]
  );

  return (
    <div
      ref={containerRef}
      className="react-grid-host"
      style={{ width: "100%", height: gridHeight }}
    >
      <AgGridReact<TData>
        gridOptions={gridOptions}
        theme={agGridTheme}
        rowSelection={normalizedRowSelection}
        columnDefs={columnDefs}
        rowData={rowData}
        loading={loading}
        onRowSelected={onRowSelected}
        onFilterChanged={handleFilterChanged}
        onSelectionChanged={handleSelectionChanged}
        onGridReady={handleGridReady}
      />
    </div>
  );
}

export const GridContent = forwardRef(GridContentInner) as <TData = unknown>(
  props: GridContentProps<TData> & {
    ref?: React.ForwardedRef<GridContentHandle<TData>>;
  }
) => React.ReactElement;
