import dayjs from "dayjs";
import type { GridOptions } from "ag-grid-community";
import { AG_GRID_LOCALE_KR } from "@/components/ag-grid/locale/ko-KR";
import { CustomLoadingOverlay } from "@/react/components/ag-grid/CustomLoadingOverlay";

const textComparator = (left?: unknown, right?: unknown) =>
  (left ?? "").toString().localeCompare((right ?? "").toString());

export const defaultGridOptions: GridOptions = {
  localeText: AG_GRID_LOCALE_KR,
  loadingOverlayComponent: CustomLoadingOverlay,
  headerHeight: 44,
  rowHeight: 44,
  paginationPageSizeSelector: [15, 30, 50, 100],
  defaultColDef: {
    flex: 1,
    minWidth: 100,
    suppressMovable: true,
    resizable: true,
    sortable: true,
    filter: true,
  },
  columnTypes: {
    text: {
      filter: "agTextColumnFilter",
      filterParams: { maxNumConditions: 1 },
      comparator: textComparator,
      cellStyle: { textAlign: "center" },
    },
    string: {
      filter: "agTextColumnFilter",
      filterParams: { maxNumConditions: 1 },
      comparator: textComparator,
      cellStyle: { textAlign: "center" },
    },
    number: {
      filter: "agNumberColumnFilter",
      filterParams: { maxNumConditions: 1 },
      cellStyle: { textAlign: "right" },
    },
    boolean: {
      filter: "agTextColumnFilter",
      filterParams: { maxNumConditions: 1 },
      valueFormatter: (params: { value?: boolean | null }) => {
        if (params.value == null) {
          return "";
        }

        return params.value ? "Y" : "N";
      },
      cellStyle: { textAlign: "center" },
    },
    date: {
      filter: "agDateColumnFilter",
      filterParams: { maxNumConditions: 1 },
      cellStyle: { textAlign: "center" },
      valueFormatter: (params: { value?: string | null }) => {
        if (!params.value) {
          return "";
        }

        return dayjs(params.value).format("YYYY-MM-DD");
      },
    },
    datetime: {
      filter: "agDateColumnFilter",
      filterParams: { maxNumConditions: 1 },
      cellStyle: { textAlign: "center" },
      valueFormatter: (params: { value?: string | null }) => {
        if (!params.value) {
          return "";
        }

        return dayjs(params.value).format("YYYY-MM-DD HH:mm:ss");
      },
    },
  },
};
