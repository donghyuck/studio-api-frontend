<template>
    <PageToolbar :title="title" :label="subtitle" :closeable="false" @refresh="refresh" :divider="false" @create="addRow()"
        :items="[{ icon: 'mdi-plus', event: 'create' , tooltip: '추가'}, 
        { icon: 'mdi-refresh', event: 'refresh' }]">
    </PageToolbar>
    <AgGridVue class="ag-theme-quartz properties-grid" :columnDefs="columnDefs" :rowData="gridData" :style="gridStyle"
        :gridOptions="gridOptions" @grid-ready="onGridReady" @cellEditingStarted="onCellEditingStarted"
        @cellEditingStopped="onCellEditingStopped" @cellValueChanged="onCellValueChanged">
    </AgGridVue>
</template>
<script setup lang="ts">
import "ag-grid-community/styles/ag-grid.css"; // Mandatory CSS required by the grid
import "ag-grid-community/styles/ag-theme-quartz.css"; // Optional Theme applied to the grid
// define grid componet : ag-gird  
import ActionCellRenderer from '@/components/ag-grid/renderer/ActionCellRenderer.vue';
import PageToolbar from '@/components/bars/PageToolbar.vue';
import type { Property } from '@/types/studio';
import type { ColDef, GridApi, GridOptions } from 'ag-grid-community';
import { AgGridVue } from "ag-grid-vue3"; // Vue Data Grid Component 
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

// define props with default values.
const props = withDefaults(defineProps<{
    title?: string | undefined
    subtitle?: string | undefined
    width?: string | number
    height?: string | number
    rowData?: Property[]
}>(), {
    width: "auto",
    height: "400px",
    rowData: () => []
});
const gridStyle = computed(() => ({
    height: props.height,
    width: props.width,
}))
type PropertyRow = Property & {
    isEdit?: boolean;
    isNew?: boolean;
    nameError?: 'required' | 'duplicate' | null;
};

const gridOptions: GridOptions = {
    getRowHeight: () => 40,
    headerHeight: 36,
    animateRows: true,
    rowSelection: 'multiple',
    suppressRowClickSelection: false,
    enableCellTextSelection: true,
    defaultColDef: {
        flex: 1,
        minWidth: 120,
        resizable: true,
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
        tooltip: (ctx: any) => `${ctx.data?.name ?? ''} 속성을 삭제합니다.`,
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
    {
        field: 'name',
        headerName: '이름',
        type: 'string',
        flex: 1,
        editable: (params: any) => isEditable(params.data),
        cellClassRules: {
            'cell-error': (params: any) => !!params.data?.nameError,
        },
    },
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
const gridData = ref<PropertyRow[]>([]);
const updatedData = ref([]);
const loader = ref(false);

const emit = defineEmits<{
    (e: 'update:modelValue', v: Property[]): void
    (e: 'change', v: Property[]): void
}>()

watch(() => props.rowData, () => {
    refresh();
}, { deep: true })


function emitAll(reason = 'change') {
    const all: Property[] = []
    if (gridApi.value) {
        gridApi.value.forEachNode((n: any) => all.push({ ...n.data }))
    } else {
        all.push(...gridData.value as Property[])
    }
    emit('change', all)               // 필요 시 후킹해서 사용
}

function normalizeName(name: unknown) {
    return (name ?? '').toString().trim();
}

function getAllRows(): PropertyRow[] {
    const rows: PropertyRow[] = [];
    if (gridApi.value) {
        gridApi.value.forEachNode((n: any) => rows.push({ ...n.data }));
        return rows;
    }
    return [...gridData.value];
}

function validateRows() {
    const rows = getAllRows();
    const counts = new Map<string, number>();
    rows.forEach((row) => {
        const key = normalizeName(row.name);
        if (!key) return;
        counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    rows.forEach((row) => {
        const key = normalizeName(row.name);
        if (!key) {
            row.nameError = 'required';
            return;
        }
        row.nameError = (counts.get(key) ?? 0) > 1 ? 'duplicate' : null;
    });
    gridData.value = rows;
    gridApi.value?.refreshCells({ force: true });
}

function sortRowsByName() {
    gridData.value = [...gridData.value].sort((a, b) =>
        normalizeName(a.name).localeCompare(normalizeName(b.name))
    );
    gridApi.value?.setGridOption('rowData', gridData.value);
}

async function refresh() {
    const api = gridApi.value;
    try {
        loader.value = true
        if (api) api.setGridOption('loading', true)
        const rows = Array.isArray(props.rowData)
            ? props.rowData.map((row) => ({ ...row, isNew: false, isEdit: false, nameError: null }))
            : []
        gridData.value = rows;
        sortRowsByName();
        total.value = rows.length
        updatedData.value = []
        if (api) {
            api.setGridOption('rowData', gridData.value) // v32 권장
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
let gridKeyHandler: ((event: KeyboardEvent) => void) | null = null;
const onGridReady = (params: any) => {
    gridApi.value = params.api;
    const gui = params.api?.getGui?.();
    if (gui) {
        gridKeyHandler = (event: KeyboardEvent) => {
            const isEditing = (gridApi.value?.getEditingCells?.() ?? []).length > 0;
            const isMac = navigator.userAgent.includes('Mac');
            const ctrlOrCmd = isMac ? event.metaKey : event.ctrlKey;
            if (ctrlOrCmd && event.key.toLowerCase() === 's') {
                event.preventDefault();
                validateRows();
                emitAll();
                return;
            }
            if (ctrlOrCmd && event.key.toLowerCase() === 'c') {
                event.preventDefault();
                copySelectedRows();
                return;
            }
            if (ctrlOrCmd && event.key.toLowerCase() === 'v') {
                event.preventDefault();
                pasteRowsFromClipboard();
                return;
            }
            if (!isEditing && (event.key === 'Delete' || event.key === 'Backspace')) {
                event.preventDefault();
                removeSelectedRows();
                return;
            }
            if (!isEditing && event.key === 'Enter') {
                event.preventDefault();
                addRow();
                return;
            }
        };
        gui.addEventListener('keydown', gridKeyHandler);
    }
};


// event handle
const onCellEditingStarted = (event: any) => {
    event.data.isEdit = true;
};

const onCellEditingStopped = (event: any) => {
    const data = event.data;
    const hasName = normalizeName(data.name).length > 0;
    const hasValue = normalizeName(data.value).length > 0;
    if (!hasName && !hasValue) {
        gridApi.value?.applyTransaction({ remove: [data] });
        gridData.value = gridData.value.filter((row) => row !== data);
    }
    validateRows();
};

const onCellValueChanged = (event: any) => {
    if (event.oldValue != event.newValue) {
        event.data.isEdit = true;
        if (event.colDef?.field === 'name') {
            event.data.nameError = null;
        }
        validateRows();
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
    const newItem: PropertyRow = { name: null, value: null, isEdit: false, isNew: true, nameError: 'required' };
    const newRow = gridApi.value?.applyTransaction({ add: [newItem] });
    if (newRow?.add) {
        gridData.value = [...gridData.value, newItem];
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

onBeforeUnmount(() => {
    const gui = gridApi.value?.getGui?.();
    if (gui && gridKeyHandler) {
        gui.removeEventListener('keydown', gridKeyHandler);
    }
    gridKeyHandler = null;
});

function removeSelectedRows() {
    const rows = gridApi.value?.getSelectedRows?.() ?? [];
    if (rows.length === 0) return;
    gridApi.value?.applyTransaction({ remove: rows });
    gridData.value = gridData.value.filter((row) => !rows.includes(row));
    emitAll();
}

async function copySelectedRows() {
    const rows = gridApi.value?.getSelectedRows?.() ?? [];
    if (rows.length === 0) return;
    const text = rows
        .map((row: PropertyRow) => `${normalizeName(row.name)}\t${row.value ?? ''}`)
        .join('\n');
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        // no-op: clipboard may be blocked
    }
}

async function pasteRowsFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        if (!text) return;
        const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
        if (lines.length === 0) return;
        const rows: PropertyRow[] = lines.map((line) => {
            const parts = line.split(/\t|,/);
            const name = normalizeName(parts[0]);
            const value = parts.slice(1).join('\t').trim();
            return { name, value, isEdit: true, isNew: false, nameError: null };
        }).filter((row) => row.name.length > 0);
        if (rows.length === 0) return;
        gridApi.value?.applyTransaction({ add: rows });
        gridData.value = [...gridData.value, ...rows];
        sortRowsByName();
        validateRows();
        emitAll();
    } catch {
        // no-op: clipboard may be blocked
    }
}

</script>
<style>
.ag-paging-panel {
    border-top: 0px;
}
.properties-grid .cell-error {
    background-color: #ffecec;
}
</style>
