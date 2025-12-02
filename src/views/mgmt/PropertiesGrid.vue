<template>
    <PageToolbar title="" :closeable="false" @refresh="refresh" :divider="false" @create="addRow()"
        :items="[{ icon: 'mdi-plus', event: 'create' }, { icon: 'mdi-refresh', event: 'refresh' }]">
    </PageToolbar>
    <AgGridVue class="ag-theme-quartz" :columnDefs="columnDefs" :rowData="gridData" :style="gridStyle"
        :gridOptions="gridOptions" @grid-ready="onGridReady" @cellEditingStarted="onCellEditingStarted"
        @cellEditingStopped="onCellEditingStopped" @cellValueChanged="onCellValueChanged">
    </AgGridVue>
</template>
<script setup lang="ts">
import "ag-grid-community/styles/ag-grid.css"; // Mandatory CSS required by the grid
import "ag-grid-community/styles/ag-theme-quartz.css"; // Optional Theme applied to the grid
// define grid componet : ag-gird  
import ActionCellRenderer from '@/components/ag-grid/renderer/ActionCellRenderer.vue';
import PageToolbar from '@/components/buttons/PageToolbar.vue';
import type { Property } from '@/types/studio';
import type { ColDef, GridApi, GridOptions } from 'ag-grid-community';
import { AgGridVue } from "ag-grid-vue3"; // Vue Data Grid Component 
import { computed, nextTick, onMounted, ref, watch } from "vue";

// define props with default values.
const props = withDefaults(defineProps<{
    width?: string | number
    height?:string | number
    rowData?: Property[]
}>(), {
    width: "auto",
    height: "400px",
    rowData: () => []
});
const gridStyle = computed(() => ({
  height: props.height ,
}))
const gridOptions: GridOptions = {
    getRowHeight: params => 40,
    defaultColDef: {
        flex: 1,
        minWidth: 100,
        resizable: false,
        sortable: true,
        filter: false
    },
    columnTypes: {
        string: {
            filter: 'agTextColumnFilter',
            filterParams: { suppressAndOrCondition: true },
            cellStyle: { textAlign: 'left' },
        }
    },
};

const columnActions = [
    {
        label: '삭제',
        prependIcon: 'mdi-delete',
        variant: 'outlined',
        color: 'red',
        event: 'delete',
        visible: true,
        tooltip: (ctx:any) => `${ctx.data?.name ?? ''} 속성을 삭제합니다.`,
    },
];

async function onAction({ action, row }: { action: string; row: any }) {
    if (action === 'save') { 
        handleSave({ data: row });
    } else if (action === 'delete') { 
        gridApi.value?.applyTransaction({ remove: [row] });
        emitAll();
    }
}

const columnDefs: ColDef[] = [
    { field: 'name', headerName: '속성', type: 'string', flex: 1, editable: (params: any) => isEditable(params.data) },
    { field: 'value', headerName: '값', type: 'string', filter: false, flex: 2, editable: true },
    {
        headerName: '',
        flex: .2,
        field: 'actions',
        editable: false,
        filter: false,
        sortable: false,
        resizable: false,
        cellRenderer: ActionCellRenderer,
        cellRendererParams: { actions: columnActions, onAction }
    },
]

const total = ref(0);
const gridData = ref<Property[]>();
const updatedData = ref([]);
const loader = ref(false);

const emit = defineEmits<{
  (e: 'update:modelValue', v: Property[]): void
  (e: 'change', v: Property[]): void
}>()

watch(() => props.rowData, v => {
 
}, { deep: true })


function emitAll(reason = 'change') { 
  const all: Property[] = []
  if (gridApi.value) {
    gridApi.value.forEachNode((n: any) => all.push({ ...n.data }))
  } else {
    all.push(...gridData.value as Property[] )
  }  
  emit('change', all)               // 필요 시 후킹해서 사용
}

async function refresh() {
    const api = gridApi.value;
    try {
        loader.value = true
        if (api) api.setGridOption('loading', true)
        const rows = Array.isArray(props.rowData) ? [...props.rowData] : []
        gridData.value = rows;
        total.value = rows.length
        updatedData.value = []
        if (api) {
            api.setGridOption('rowData', rows) // v32 권장
            api.refreshCells({ force: true }) // 보통 불필요
        }
        await nextTick()
    } catch (e) {
        console.error('refresh failed:', e)
    } finally {
        if (gridApi.value) gridApi.value.setGridOption('loading', false)
        loader.value = false
    }
}

function isEditable(data: any) {
    if (data.hasOwnProperty('isNew') && data.isNew === true)
        return true;
    return false;
}

const gridApi = ref<GridApi | null>();
const onGridReady = (params: any) => {
    gridApi.value = params.api; 
};


// event handle
const onCellEditingStarted = (event: any) => {
    event.data.isEdit = true; 
};

const onCellEditingStopped = (event: any) => {
    const data = event.data; 
    if (!data.name && data.name === null) {
        gridApi.value?.applyTransaction({ remove: [data] });
    }
};

const onCellValueChanged = (event: any) => { 
    if (event.oldValue != event.newValue) {
        event.data.isEdit = true;
        gridApi.value?.refreshCells({ force: true });

        emitAll();
    }
};

const handleSave = async (event: any) => { 
    gridApi.value?.showLoadingOverlay();
    gridApi.value?.hideOverlay();
    gridApi.value?.refreshCells({ force: true });
};

const handleDelete = async (event: any) => {
    console.log("handleDelete", event);
    //event.api
    gridApi.value?.showLoadingOverlay();
    gridApi.value?.hideOverlay();
    gridApi.value?.applyTransaction({ remove: [event.data] });
    queueMicrotask(() => emitAll());
};

async function addRow() {
    const newItem = { name: null, value: null, isEdit: false, isNew: true };
    const newRow = gridApi.value?.applyTransaction({ add: [newItem] });
    if (newRow?.add) {
        const newRowIndex = newRow.add[0].rowIndex;
        gridApi.value?.startEditingCell({
            rowIndex: newRowIndex || 0,
            colKey: 'name',
        });
    }
}
onMounted(async () => { 
    refresh();
});
 
</script>
<style>
.ag-paging-panel{
    border-top :0px;
}
</style>