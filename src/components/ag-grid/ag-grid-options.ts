import CustomLoadingOverlay from "@/components/ag-grid/CustomLoadingOverlay.vue";
import CheckboxRenderer from "@/components/ag-grid/renderer/CheckboxRenderer.vue";
import CustomBooleanFilter from "@/components/ag-grid/renderer/CustomBooleanFilter.vue";
import type { GridOptions } from "ag-grid-community";
import { themeMaterial } from "ag-grid-community";

import dayjs from "dayjs";
import { HyperlinksCellRenderer } from "./renderer/HyperlinksCellRenderer";
import { AG_GRID_LOCALE_KR } from "./locale/ko-KR";
  
const textComparator = (a?: any, b?: any) =>
  (a ?? '').toString().localeCompare((b ?? '').toString());

const gridOptions: GridOptions = {
  theme: themeMaterial,
  localeText: AG_GRID_LOCALE_KR,
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
    text: {
      filter: "agTextColumnFilter",
      filterParams: { maxNumConditions: 1 },
      cellStyle: { textAlign: "center" },
    },
    string: {
      filter: "agTextColumnFilter",
      filterParams: { maxNumConditions: 1 },
      cellStyle: { textAlign: "center" },
    },
    hyperlinks:{
      filter: "agTextColumnFilter",
      cellRenderer: HyperlinksCellRenderer, 
      filterValueGetter: (p: any) => (p?.value ?? "").toString(),
      comparator: textComparator,              
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
