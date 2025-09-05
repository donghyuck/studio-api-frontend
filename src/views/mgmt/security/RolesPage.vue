<template>
    <v-row>
        <v-col cols="12" md="12">
                <GridContent ref="gridContentRef" :rowData="gridData" :rowSelection="'single'"
                    @row-selected="onRowSelected"
                    :events="[]"
                    style="" :auto-resize="false" :columns="columnDefs">
                </GridContent> 
        </v-col>
    </v-row>
</template>    
<script setup lang="ts">
import GridContent from '@/components/ag-grid/GridContent.vue'; 
import { onMounted, ref } from 'vue';
import type { ColDef } from 'ag-grid-community';
import { usePageableRolesStore } from '@/stores/pem/roles.store';

const rolesStore = usePageableRolesStore();

// grid 
const gridData = ref<any[]>();
const loader = ref(false);
// define grid columns
const columnDefs: ColDef[] = [
    { field: 'name', headerName: '이름', filter: false, sortable: true, type: "string", flex: 1 },
    { field: 'description', headerName: '설명', filter: false, sortable: false, type: 'string', flex: 2, },
    { field: 'creationDate', headerName: '생성일', filter: false, type: 'date', flex: 1 },
    { field: 'modifiedDate', headerName: '수정일', filter: false, type: 'date',  flex: 1 },
];
 
const gridContentRef = ref<InstanceType<typeof GridContent> | null>(null);
const onRowSelected = (event: any) => {
    if (event.node.selected) {
        const selectedData = event.node.data;
    }
};

async function getData(force: boolean = false) {
    loader.value = true;
    if (force || !rolesStore.isLoaded)
        await rolesStore.fetch(); 
    gridData.value = [...rolesStore.dataItems];
    loader.value = false;
}

onMounted(() => {
    getData(true);
});
 
</script>