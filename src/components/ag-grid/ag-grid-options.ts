import "ag-grid-community/styles/ag-grid.css"; // Mandatory CSS required by the grid
import "ag-grid-community/styles/ag-theme-quartz.css"; // Optional Theme applied to the grid

import CustomLoadingOverlay from "@/components/ag-grid/CustomLoadingOverlay.vue";
import CheckboxRenderer from "@/components/ag-grid/renderer/CheckboxRenderer.vue";
import CustomBooleanFilter from "@/components/ag-grid/renderer/CustomBooleanFilter.vue";
import type { GridOptions } from "ag-grid-community";
import dayjs from "dayjs";

const gridOptions: GridOptions = {
  loadingOverlayComponent: CustomLoadingOverlay,
  paginationPageSizeSelector:[ 15, 30, 50, 100],
  defaultColDef: {
    flex: 1,
    minWidth: 100,
    suppressMovable: true,
    resizable: true,
    sortable: true,
    filter: true,
    cellStyle: {
      display: "flex",
      alignItems: "center",
    },
  },
  columnTypes: {
    string: {
      filter: "agTextColumnFilter",
      filterParams: { maxNumConditions: 1 },
      cellStyle: { textAlign: "center" },
    },
    number: {
      filter: "agNumberColumnFilter",
      filterParams: { maxNumConditions: 1 },
      cellStyle: { textAlign: "right" },
    },
    boolean: {
      cellRenderer: CheckboxRenderer,
      cellStyle: { textAlign: "center" },
      filter: CustomBooleanFilter,
      filterParams: { values: [true, false], maxNumConditions: 1 },
    },
    date: {
      filter: "agDateColumnFilter",
      filterParams: { maxNumConditions: 1 },
      cellStyle: { textAlign: "center" },
      valueFormatter: (params) => {
        if (!params.value) return "";
        return dayjs(params.value).format("YYYY-MM-DD");
      },
    },
    datetime: {
      filter: "agDateColumnFilter",
      cellStyle: { textAlign: "center" },
      valueFormatter: (params) => {
        if (!params.value) return "";
        return dayjs(params.value).format("YYYY-MM-DD HH:mm:ss");
      },
    },
  },
};
export default gridOptions;
