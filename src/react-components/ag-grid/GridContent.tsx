// src/react-components/ag-grid/GridContent.tsx
import React, { useRef, useState, useEffect, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridOptions, GridApi, SelectionChangedEvent, RowSelectionOptions, IRowNode } from 'ag-grid-community';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css'; // This can be replaced with a custom theme if needed

interface Listener {
  type: string;
  listener: (event: any) => void;
}

interface GridContentProps {
  columns?: ColDef[];
  options?: GridOptions;
  events?: Listener[];
  rowSelection?: RowSelectionOptions | "single" | "multiple";
  rowData: any[];
  autoResize?: boolean;
  height?: number;
  onRowSelected?: (event: { data: any; node: IRowNode; }) => void;
  onFilterActived?: (isActive: boolean) => void;
}

export interface GridContentRef {
  refresh: () => void;
  clearFilters: () => void;
  selectedRows: () => any[];
  displayedRowCount: () => number;
  reserveScrollTo: (last: number) => void;
  loading: (isLoading: boolean) => void;
}

const defaultGridOptions: GridOptions = {
  // Default options, can be overridden by props.options
  // Vue version used '@/components/ag-grid/ag-grid-options' for defaults
  // For now, using a minimal default, specific overrides should come from props.options
};

const GridContent = forwardRef<GridContentRef, GridContentProps>(({
  columns,
  options,
  events,
  rowSelection = 'single',
  rowData,
  autoResize = false,
  height,
  onRowSelected,
  onFilterActived,
}, ref) => {
  const gridRef = useRef<AgGridReact>(null);
  const gridApi = useRef<GridApi | null>(null);
  const [gridHeight, setGridHeight] = useState(height ?? 400); // initial height
  const [filtersActive, setFiltersActive] = useState(false);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const reservedScrollIndex = useRef<number>(0);

  const columnDefs = useMemo<ColDef[]>(() => columns || [], [columns]);
  const gridOptionsDefs = useMemo<GridOptions>(() => ({ ...defaultGridOptions, ...options }), [options]);

  const resizeGrid = useCallback(() => {
    if (gridRef.current && gridRef.current.api && gridRef.current.eGridDiv) {
      // Mimic Vue's dynamic height adjustment
      const containerTop = gridRef.current.eGridDiv.getBoundingClientRect().top;
      setGridHeight(window.innerHeight - containerTop - 25); // Adjust as needed
      gridRef.current.api.sizeColumnsToFit();
    }
  }, []);

  const onGridReady = useCallback((params: { api: GridApi; }) => {
    gridApi.current = params.api;
    events?.forEach((item: Listener) =>
      params.api.addEventListener(item.type, item.listener)
    );
    if (autoResize || height == null) {
      resizeGrid();
    }
  }, [events, autoResize, height, resizeGrid]);

  const handleSelectionChanged = useCallback((event: SelectionChangedEvent) => {
    const newSelectedRows = event.api.getSelectedRows();
    setSelectedItems(newSelectedRows);
  }, []);

  const handleRowSelected = useCallback((event: any) => {
    // Vue version emitted specific event, mimick that for parent
    if (onRowSelected) {
      onRowSelected(event);
    }
  }, [onRowSelected]);

  const onRowDataUpdated = useCallback(() => {
    if (reservedScrollIndex.current > 0 && gridApi.current) {
      gridApi.current.ensureIndexVisible(reservedScrollIndex.current, 'middle');
      reservedScrollIndex.current = -1; // Reset after use
    }
  }, []);

  // Expose methods to parent component using ref
  useImperativeHandle(ref, () => ({
    refresh: () => {
      gridApi.current?.refreshInfiniteCache();
    },
    clearFilters: () => {
      gridApi.current?.setFilterModel(null); // setFilterModel({}) clears, null for all filters
      gridApi.current?.onFilterChanged();
    },
    selectedRows: () => {
      return selectedItems;
    },
    displayedRowCount: () => {
      return gridApi.current?.getDisplayedRowCount() ?? 0;
    },
    reserveScrollTo: (last: number = 0) => {
      if (last > 0) {
        reservedScrollIndex.current = last;
      }
    },
    loading: (isLoading: boolean = false) => {
      // AG Grid React has its own loading overlay mechanisms,
      // this might need adaptation based on how the Vue version used it.
      // For now, a placeholder, as setGridOption('loading') is not standard.
      // A common way is to use custom loading overlay components or context.
      console.warn('AG Grid React `loading` method needs specific implementation based on actual loading strategy.');
    },
  }));

  // Watch for changes in window size for autoResize
  useEffect(() => {
    if (autoResize || height == null) {
      window.addEventListener('resize', resizeGrid);
      return () => window.removeEventListener('resize', resizeGrid);
    }
  }, [autoResize, height, resizeGrid]);

  // Propagate filter status
  useEffect(() => {
    if (onFilterActived) {
      // AG Grid v30+ has filterChanged event, can check if filters are active
      const currentFiltersActive = gridApi.current?.isAnyFilterPresent() || false;
      if (currentFiltersActive !== filtersActive) {
        setFiltersActive(currentFiltersActive);
        onFilterActived(currentFiltersActive);
      }
    }
  }, [filtersActive, onFilterActived]); // This effect might need to be triggered by a grid event

  return (
    <div style={{ width: '100%', height: gridHeight + 'px' }} className="ag-theme-alpine">
      <AgGridReact
        ref={gridRef}
        rowData={rowData}
        columnDefs={columnDefs}
        gridOptions={gridOptionsDefs}
        rowSelection={rowSelection as any} // Cast as any because type definition might be slightly off for string literals
        onGridReady={onGridReady}
        onSelectionChanged={handleSelectionChanged}
        onRowClicked={handleRowSelected} // Assuming row-selected means rowClicked for simple selection
        onRowDataUpdated={onRowDataUpdated}
        defaultColDef={{ resizable: true }}
        // onFilterChanged={() => { /* logic to update filtersActive state */ }} // Need to hook this up
      />
    </div>
  );
});

export default GridContent;
