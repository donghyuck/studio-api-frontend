<template>
  <div
    ref="gridContainer"
    class="ag-theme-alpine"
    :style="{ width: '100%', height: gridHeight + 'px' }"
  >
    <AgGridVue
      class="ag-theme-quartz"
      style="width: 100%; height: 100%"
      :rowModelType="'infinite'"
      :gridOptions="gridOptionsDefs"
      :columnDefs="columnDefs"
      :pagination="true"
      :paginationPageSize="pageSize"
      :cacheBlockSize="cacheBlockSize"
      @selectionChanged="onSelectionChanged"
      @grid-ready="onGridReady"
    >
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
  import type { PageableDataSource } from '@/types/ag-grid';
  import type {
    ColDef,
    GridApi,
    GridOptions,
    IGetRowsParams,  
    SelectionChangedEvent, 
  } from 'ag-grid-community';
  import { AgGridVue } from 'ag-grid-vue3'; // Vue Data Grid Component
  import { computed, defineProps, onMounted, ref, watch } from 'vue';

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
    datasource: PageableDataSource;
  }>();

  //  페이지 크기 및 캐시 크기 설정
  const pageSize = ref(props.datasource?.pageSize);
  const cacheBlockSize = ref(props.datasource?.pageSize);

  // 로딩 및 데이터 관리
  const loader = ref(false);
  const gridData = ref<any[]>([]);
  const total = ref<number>(0);

  // Grid options 설정 

  // 프로퍼티로 전달된 옵션을 사용하거나 기본값 사용
  const gridOptionsDefs: GridOptions = computed(
    () => props.options || gridOptions
  );

  // Grid columns 설정
  // 프로퍼티로 전달된 컬럼을 사용하거나 빈 배열 사용
  const columnDefs: ColDef[] = computed(() =>
    (props.columns || []).map((col) => ({
      ...col,
      colId: toSnakeCase(col.field ?? ''), // 예: creationDate → creation_date
    }))
  );

  function toSnakeCase(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase();
  }

  // 그리드 동적 크기 조정
  const gridContainer = ref<HTMLElement | null>(null);
  const gridHeight = ref(400); // initial height
  const resizeGrid = () => {
    if (gridContainer.value) {
      gridHeight.value =
        window.innerHeight -
        gridContainer.value.getBoundingClientRect().top -
        20; // Adjust as needed
      gridApi.value?.sizeColumnsToFit();
    }
  };

  //  Grid API 설정
  const gridApi = ref<GridApi | null>();
  const onGridReady = (params: any) => {
    gridApi.value = params.api;
    const dataSource = {
      getRows: async (params: IGetRowsParams) => {
        // 페이지 및 페이지 크기 설정
        const page = Math.floor(params.startRow / pageSize.value);
        const pageSizeValue = params.endRow - params.startRow;
        // 필터 및 정렬 설정
        const filterModel = params.filterModel;
        const sortModel = params.sortModel;
        try {
          props.datasource?.setSort(sortModel);
          //props.datasource?.setFilter(filterModel);
          props.datasource?.setPage(page);
          // 필터가 설정되어 있는 경우
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
    // 이벤트 리스너 설정
    props.events?.forEach((item) =>
      params.api.addEventListener(item.type, item.listener)
    );
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

  // 선택된 행 관리
  const selectedItems = ref<[]>([]);
  const onSelectionChanged = (params: SelectionChangedEvent) => {
    selectedItems.value = params.api.getSelectedRows() as [];
  };
  const selectedRows = () => {
    return selectedItems.value;
  };

  const tooltipShowDelay = ref(null);

  // 데이터 가져오기
  // force : true 인 경우 데이터를 강제로 가져옴
  async function getData(force: boolean = false) {
    if (!props.datasource) {
      console.error('Datasource is not provided.');
      return;
    }

    loader.value = true;
    gridApi.value?.setGridOption('loading', true);
    if (!props.datasource?.isLoaded || force) await props.datasource?.fetch();

    gridData.value = props.datasource?.dataItems;
    total.value = props.datasource?.total as number;

    gridApi.value?.setGridOption('loading', false);
    if (total.value === 0) gridApi.value?.showNoRowsOverlay();
    loader.value = false;
  }

  onMounted(async () => {
    // Initial resize
    resizeGrid();
    console.log( props )
  });

  defineExpose({
    refresh,
    clearFilters,
    selectedRows,
  });
</script>
