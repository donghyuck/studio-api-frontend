<template>
    <v-dialog :width="width" transition="dialog-bottom-transition">
        <v-card>
            <PageToolbar title="Properties" @close="emit('close')" :closeable="true" @refresh="refresh" :divider="true"
                @create="addRow()"
                :items="[{ icon: 'mdi-plus', event: 'create' }, { icon: 'mdi-refresh', event: 'refresh' }]">
            </PageToolbar>
            <v-card-text class="pa-0" style="min-height:450px;">
                <v-container class="pa-0">
                    <v-row>
                        <v-col cols="12" md="12">
                            <div class="ag-theme-quartz">
                                <AgGridVue class="ag-theme-quartz" :columnDefs="columnDefs" :rowData="gridData"
                                    style="height:400px;" :gridOptions="gridOptions" @grid-ready="onGridReady"
                                    :rowHeight="40" @cellEditingStarted="onCellEditingStarted"
                                    @cellEditingStopped="onCellEditingStopped" @cellValueChanged="onCellValueChanged">
                                </AgGridVue>
                            </div>
                        </v-col>
                    </v-row>
                </v-container>
            </v-card-text>
            <v-card-actions>
                <v-spacer />
                <v-btn variant="tonal" color="grey" rounded="xl" width="100" @click="emit('close')">
                    Cancel
                </v-btn>
                <v-btn variant="outlined" prepend-icon="mdi-content-save" rounded="xl" color="primary" width="100"
                    @click="submit">
                    Save
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
<style>
.ag-theme-quartz .ag-root-wrapper {
    border: 0 !important;
}
.ag-theme-quartz .cell-error {
    background-color: #ffecec;
}
</style>
<script setup lang="ts">
import { ref, watch } from 'vue';
import PageToolbar from '@/components/bars/PageToolbar.vue';
import { useToast } from '@/plugins/toast';

// define grid componet : ag-gird  
import { AgGridVue } from "ag-grid-vue3"; // Vue Data Grid Component
import type { GridApi } from 'ag-grid-community';
import type { GridOptions, ColDef } from 'ag-grid-community';
import ActionCellRenderer from '@/components/ag-grid/renderer/ActionCellRenderer.vue';

type PropertyRow = {
    name: string | null;
    value: string | null;
    isEdit?: boolean;
    isNew?: boolean;
    nameError?: 'required' | 'duplicate' | null;
};

const toast = useToast();

const gridOptions: GridOptions = {
    getRowHeight: params => 50,
    defaultColDef: {
        flex: 1,
        minWidth: 100,
        resizable: false,
        sortable: true,
        filter: true
    },
    columnTypes: {
        string: {
            filter: 'agTextColumnFilter',
            filterParams: { suppressAndOrCondition: true },
            cellStyle: { textAlign: 'center' },
        }
    },
};

const columnDefs: ColDef[] = [
    {
        field: 'name',
        headerName: 'Name',
        type: 'string',
        flex: 1,
        editable: (params: any) => isEditable(params.data),
        cellClassRules: {
            'cell-error': (params: any) => !!params.data?.nameError,
        },
    },
    { field: 'value', headerName: 'Value', type: 'string', filter: false, flex: 2, editable: true },
    {
        headerName: 'Actions',
        field: 'actions',
        editable: false,
        filter: false,
        sortable: false,
        resizable: false,
        cellRenderer: ActionCellRenderer,
        cellRendererParams: {
            actions: [
                { label: '삭제', icon: 'mdi-delete', event: 'delete', color: 'error', iconOnly: true },
            ],
            onAction: ({ action, row }: { action: string; row: PropertyRow }) => {
                if (action === 'delete') removeRow(row);
            },
        },
    },
]

function isEditable(data: any) {
    if (data.hasOwnProperty('isNew') && data.isNew === true)
        return true;
    return false;
}

const gridApi = ref<GridApi | null>();

const onGridReady = (params: any) => {
    gridApi.value = params.api;
};

// define emits
const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'submit', payload: { name: string; value: string | null }[]): void;
}>();

// define props with default values.
const props = withDefaults(defineProps<{
    width?: string | number
    modelValue?: { name: string; value: string | null }[]
}>(), {
    width: "auto",
    modelValue: () => [],
});

// event handle
const onCellEditingStarted = (event: any) => {
    //event.data.isEdit = true;
    console.log("onCellEditingStarted", event)
};

const onCellEditingStopped = (event: any) => {
    const data = event.data;
    console.log("onCellEditingStopped", data)
    const hasName = (data.name ?? '').toString().trim().length > 0;
    const hasValue = (data.value ?? '').toString().trim().length > 0;
    if (data.isNew && !hasName && !hasValue) {
        gridApi.value?.applyTransaction({ remove: [data] });
    }
};

const onCellValueChanged = (event: any) => {
    console.log("onCellValueChanged", event)
    if (event.oldValue != event.newValue) {
        if (event.colDef?.field === 'name') {
            event.data.nameError = null;
        }
        event.data.isEdit = true;
        gridApi.value?.refreshCells({ force: true });
    }
};

const gridData = ref<PropertyRow[]>([]);
const originalData = ref<PropertyRow[]>([]);

async function refresh() {
    applyPropsData();
}

async function addRow() {
    const newItem: PropertyRow = { name: null, value: null, isEdit: false, isNew: true };
    const newRow = gridApi.value?.applyTransaction({ add: [newItem] });
    const newRowIndex = newRow?.add?.[0]?.rowIndex;
    if (newRowIndex != null) {
        gridApi.value?.startEditingCell({
            rowIndex: newRowIndex,
            colKey: 'name',
        });
    }
}

function removeRow(row: PropertyRow) {
    gridApi.value?.applyTransaction({ remove: [row] });
}

function applyPropsData() {
    const mapped = (props.modelValue ?? []).map((item) => ({
        name: item.name ?? null,
        value: item.value ?? null,
        isEdit: false,
        isNew: false,
        nameError: null,
    }));
    originalData.value = mapped.map((item) => ({ ...item }));
    gridData.value = mapped.map((item) => ({ ...item }));
}

function submit() {
    const rows = gridData.value.map((row) => ({
        row,
        name: (row.name ?? '').toString().trim(),
        value: row.value ?? null,
    }));

    const nameCounts = new Map<string, number>();
    rows.forEach(({ name }) => {
        if (!name) return;
        nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
    });
    const duplicates = new Set(
        [...nameCounts.entries()].filter(([, count]) => count > 1).map(([name]) => name)
    );

    let hasError = false;
    rows.forEach(({ row, name }) => {
        if (!name) {
            row.nameError = 'required';
            hasError = true;
            return;
        }
        if (duplicates.has(name)) {
            row.nameError = 'duplicate';
            hasError = true;
            return;
        }
        row.nameError = null;
    });

    gridApi.value?.refreshCells({ force: true });
    if (hasError) {
        toast.error('Name은 필수이며 중복될 수 없습니다.');
        return;
    }

    const result = rows.map(({ name, value }) => ({ name, value }));
    emit('submit', result);
}

watch(() => props.modelValue, () => {
    applyPropsData();
}, { immediate: true, deep: true });

</script>
