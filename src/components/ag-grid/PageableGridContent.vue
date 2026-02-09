<template>
  <div ref="gridContainer" class="ag-theme-quartz ag-theme-adapted" :style="{ width: '100%', height: gridHeight + 'px' }">
    <AgGridVue class="ag-theme-quartz ag-theme-adapted" style="width: 100%; height: 100%" :rowModelType="rowModelType"
      :gridOptions="gridOptionsDefs" :columnDefs="columnDefs" :pagination="true" :paginationPageSize="pageSize"
      :cacheBlockSize="cacheBlockSize" @paginationChanged="onPaginationChanged" @selectionChanged="onSelectionChanged"
      @grid-ready="onGridReady">
    </AgGridVue>
  </div>
</template>
<style lang="css" scoped>
.ag-paging-panel {
  border-top: 0px !important;
}
</style>
<script setup lang="ts">
import gridOptions from '@/components/ag-grid/ag-grid-options';
import { useToast } from '@/plugins/toast';
import type { PageableDataSource } from "@/types/ag-gird";
import { resolveAxiosError, sleep } from '@/utils/helpers';
import type {
  ColDef,
  GridApi,
  GridOptions,
  IGetRowsParams,
  PaginationChangedEvent,
  SelectionChangedEvent
} from 'ag-grid-community';
import { AgGridVue } from 'ag-grid-vue3'; // Vue Data Grid Component
import { computed, onMounted, ref, watch, unref } from 'vue';

const toast = useToast();

// Event Listener 설정
interface Listener {
  type: string;
  listener: (event: any) => void;
}

// Props 설정
const props = defineProps<{
  columns?: ColDef[];
  options?: GridOptions;
  events?: Listener[];
  rowModelType?: string;
  datasource: PageableDataSource;
  colIdToSnakeCase?: boolean;
  height?: number | undefined;
}>();

const rowModelType = computed<string>(() =>
  props.rowModelType ?? 'infinite'
)
//  페이지 크기 및 캐시 크기 설정
const pageSize = ref(props.datasource?.pageSize);
const cacheBlockSize = ref(props.datasource?.pageSize);
const onPaginationChanged = (e: PaginationChangedEvent) => {
  if (e.newPageSize) {
    const newPageSize = e.api.paginationGetPageSize();
    pageSize.value = newPageSize;
    cacheBlockSize.value = newPageSize;
    props.datasource?.setPageSize(pageSize.value);
  }
};
// 로딩 및 데이터 관리
const loader = ref(false);
const gridData = ref<any[]>([]);
const total = ref<number>(0);

// Grid options 설정 

// 프로퍼티로 전달된 옵션을 사용하거나 기본값 사용
const gridOptionsDefs = computed<GridOptions>(() =>
  props.options ? { ...gridOptions, ...props.options } : gridOptions
)

// Grid columns 설정
// 프로퍼티로 전달된 컬럼을 사용하거나 빈 배열 사용
const columnDefs = computed<ColDef[]>(() =>
  (props.columns || []).map((col) => ({
    ...col,
    colId: toSnakeCase(col.field ?? ''), // 예: creationDate → creation_date
  }))
);

function toSnakeCase(str: string): string {
  if (props.colIdToSnakeCase)
    return str.replace(/([A-Z])/g, '_$1').toLowerCase();
  else
    return str;
}

// 그리드 동적 크기 조정
const gridContainer = ref<HTMLElement | null>(null);
const gridHeight = ref(props.height ?? 400); // initial height 
const hasHeight = computed(() => props.height != null);
const autoResize = computed(() => !hasHeight.value);
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
  const dataSource = {
    getRows: async (params: IGetRowsParams) => {
      const page = Math.floor(params.startRow / pageSize.value);
      const filterModel = params.filterModel;
      const sortModel = params.sortModel;
      try {
        props.datasource?.setSort(sortModel);
        props.datasource?.setPage(page);
        filtersActive.value = Object.keys(filterModel).length > 0;
        await getData(true);
        params.successCallback(gridData.value, total.value);
      } catch (error) {
        console.error('Error fetching data:', error);
        params.failCallback();
      }
    },
  };
  params.api.setGridOption('datasource', dataSource);
  props.events?.forEach((item) =>
    params.api.addEventListener(item.type, item.listener)
  );
  if (autoResize.value)
    resizeGrid();
};

// 필터 관리
const emit = defineEmits(['filterActived']);
const filtersActive = ref(false);
const onFilterChanged = () => {
  const filterModel = gridApi.value?.getFilterModel();
  filtersActive.value = Object.keys(filterModel || {}).length > 0;
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

async function selectViewportRows(api: GridApi<any>, selected: boolean) {
  const numberOfElements = gridData.value!.length || 0;
  if (api.getLastDisplayedRowIndex() < numberOfElements) {
    gridApi.value!.ensureIndexVisible(numberOfElements);
  }
  const start = 0
  const end = api.getLastDisplayedRowIndex();
  for (let i = start; i <= end; i++) {
    const row = api.getDisplayedRowAtIndex(i);
    if (row) row.setSelected(selected);
  }
}
const selectAll = async () => {
  if (gridApi.value)
    selectViewportRows(gridApi.value, true);
};
const deselectAll = () => {
  gridApi.value?.deselectAll();
}
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

const warm = ref<boolean>(false);

const warmUp = () => {
  warm.value = true;
};

const isWarmUp = () => {
  const old = warm.value;
  if (old)
    warm.value = false;
  return old;
}

const goToPreviousPage = async () => {
  const previousPage = unref(props.datasource?.page) ?? 0;
  if (previousPage > 0) {
    warm.value = true;
    await sleep(50);
    gridApi.value?.paginationGoToPage(previousPage);
  }
}

const tooltipShowDelay = ref(null);

// 데이터 가져오기
// force : true 인 경우 데이터를 강제로 가져옴
async function getData(force: boolean = false) {
  if (!props.datasource) {
    console.error('Datasource is not provided.');
    return;
  }
  const resolveRef = <T,>(value: T | { value: T }) => unref(value as T);
  if (isWarmUp()) {
    total.value = resolveRef(props.datasource?.total ?? 0);
    gridData.value = [];
    return;
  } else {
    if (total.value > 0 && gridData.value.length === 0)
      gridApi.value?.purgeInfiniteCache();
  }
  if (!props.datasource?.isLoaded || force)
    try {
      loader.value = true;
      gridApi.value?.setGridOption('loading', true);
      //console.log( 'fetching ..........')
      await props.datasource?.fetch();
      gridData.value = resolveRef(props.datasource?.dataItems ?? []);
      total.value = resolveRef(props.datasource?.total ?? 0);
      //console.log( gridData.value, total.value)
    } catch (e: any) {
      toast.error(resolveAxiosError(e));
    } finally {
      gridApi.value?.setGridOption('loading', false);
    }
  if (total.value === 0) gridApi.value?.showNoRowsOverlay();
  loader.value = false;
}

onMounted(async () => {
  if (autoResize.value)
    resizeGrid();
});

defineExpose({
  refresh,
  clearFilters,
  selectedRows,
  selectAll,
  deselectAll,
  displayedRowCount,
  goToPreviousPage,

});
</script>
