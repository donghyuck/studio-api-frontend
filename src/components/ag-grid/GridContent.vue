<template>
  <div ref="gridContainer" class="ag-theme-alpine" :style="{ width: '100%', height: gridHeight + 'px' }">
    <AgGridVue class="ag-theme-quartz" style="width: 100%; height: 100%" :gridOptions="gridOptionsDefs"
      :rowSelection="rowSelectionDefs" :columnDefs="columnDefs" :rowData="rowData" @row-selected="onRowSelected"
      @row-data-updated="onRowDataUpdated" @selectionChanged="onSelectionChanged" @grid-ready="onGridReady" :defaultColDef="{ resizable: true }"></AgGridVue>
  </div>
</template>
<script setup lang="ts">
import type {
  ColDef,
  GridOptions,
  GridApi,
  SelectionChangedEvent,
  RowSelectionOptions,
} from 'ag-grid-community';
import { AgGridVue } from 'ag-grid-vue3'; // Vue Data Grid Component
import { ref, defineProps, onMounted, computed, watch, nextTick } from 'vue';
import gridOptions from '@/components/ag-grid/ag-grid-options';

interface Listener {
  type: string;
  listener: (event: any) => void;
}
const props = defineProps<{
  columns?: ColDef[];
  options?: GridOptions;
  events?: Listener[];
  rowSelection?: RowSelectionOptions | "single" | "multiple";
  rowData: [];
  autoResize?: boolean;
  height?: number | undefined;
}>();

// Grid options 설정
const gridOptionsDefs: GridOptions = computed(
  () => props.options || gridOptions
);
const rowSelectionDefs: RowSelectionOptions | "single" | "multiple" = computed(
  () => props.rowSelection || 'single'
);

// Grid columns 설정
const columnDefs: ColDef[] = computed(() => props.columns || []);

// 그리드 동적 크기 조정
const gridContainer = ref<HTMLElement | null>(null);
const gridHeight = ref(props.height ?? 400); // initial height 
const hasHeight = computed(() => props.height != null);
const resizeGrid = () => {
  if (gridContainer.value) {
    gridHeight.value = window.innerHeight - gridContainer.value.getBoundingClientRect().top - 25; // Adjust as needed
    gridApi.value?.sizeColumnsToFit();
  }
};

//  Grid API 설정
const gridApi = ref<GridApi | null>();
const onGridReady = (params: any) => {
  gridApi.value = params.api;
  props.events?.forEach((item: Listener) =>
    params.api.addEventListener(item.type, item.listener)
  );
  if (props.autoResize || props.height == null) resizeGrid();
};

// 필터 관리
const emit = defineEmits(['filterActived', 'rowSelected']);
const filtersActive = ref(false);
const onFilterChanged = () => {
  const filterModel = gridApi.value?.getFilterModel();
  filtersActive.value = Object.keys(filterModel || {}).length > 0;
};

const onRowSelected = (event: any) => {
  emit('row-selected', event);
};

// filtersActive 값이 변경되면 filtersActive 이벤트 발생
watch(filtersActive, (val, oldVal) => {
  emit('filterActived', val);
});

// 데이터 새로고침
function refresh() {
  gridApi.value?.refreshInfiniteCache();
}

//필터 초기화
const clearFilters = () => {
  gridApi.value?.setFilterModel({});
  gridApi.value?.onFilterChanged();
};

// 선택된 행 관리
const selectedItems = ref<[]>([]);
const onSelectionChanged = (params: SelectionChangedEvent) => {
  selectedItems.value = params.api.getSelectedRows() as [];
};
const selectedRows = () => {
  return selectedItems.value;
};
const displayedRowCount = () => {
  return gridApi.value?.getDisplayedRowCount() ?? 0;
};

const reservedScrollIndex = ref<number>(0);
const reserveScrollTo = (last: number = 0) => {
  if (last > 0)
    reservedScrollIndex.value = last;
};

async function onRowDataUpdated() {
  if (reservedScrollIndex.value > 0) {
    await nextTick()
    gridApi.value?.ensureIndexVisible(reservedScrollIndex.value, 'middle');
    reservedScrollIndex.value = -1;
  }
}

const loading = (loading: boolean = false) => {
  gridApi.value?.setGridOption('loading', loading);
}

onMounted(async () => {
  // Initial resize 
  if (props.autoResize || props.height == null) resizeGrid();
});

defineExpose({
  refresh,
  filtersActive,
  clearFilters,
  selectedRows,
  displayedRowCount,
  reserveScrollTo,
  loading,
});

</script>
