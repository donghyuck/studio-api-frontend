<template>
    <v-row>
        <v-col cols="12" md="12">
                <PageToolbar title="Groups" @refresh="refresh" :closeable="false" :divider="true" :items="[ 
                   { icon: 'mdi-refresh', event: 'refresh', }]"></PageToolbar>  
                <PageableGridContent @filter-actived="onPageableGridFilterActived"
                    ref="pageableGridContentRef" :datasource="dataStore" :columns="columnDefs">
                </PageableGridContent>
        </v-col>
    </v-row>
</template>    
<script setup lang="ts"> 
import PageableGridContent from '@/components/ag-grid/PageableGridContent.vue';
import { computed, onMounted, ref } from 'vue';
import type { ColDef } from 'ag-grid-community';
import { usePageableGroupsStore } from '@/stores/studio/groups.store';
import PageToolbar from '@/components/buttons/PageToolbar.vue'; 

// grid 
const dataStore = usePageableGroupsStore();
 
const gridData = ref<any[]>();
const loader = ref(false);
// define grid columns
const columnDefs: ColDef[] = [
    { field: 'name', headerName: '이름', filter: false, sortable: true, type: "string", flex: 1 },
    { field: 'description', headerName: '설명', filter: false, sortable: false, type: 'string', flex: 2, },
    { field: 'creationDate', headerName: '생성일', filter: false, type: 'date', flex: 1 },
    { field: 'modifiedDate', headerName: '수정일', filter: false, type: 'date',  flex: 1 },
]; 
const pageableGridContentRef = ref<InstanceType<typeof PageableGridContent> | null>(null);
const filtersActive = ref(false);
function onPageableGridFilterActived(event: any) {
    filtersActive.value = event;
}
const refresh = () => {
    pageableGridContentRef.value?.refresh();
}
const onClearFilters = () => {
    pageableGridContentRef.value?.clearFilters();
};
const selectedRows = computed(() => pageableGridContentRef.value?.selectedRows() || []);

onMounted(() => { 

});
 
</script>