<template>
    <v-row>
        <v-col cols="3" md="3">
            <v-btn :disabled="downloading" :loading="downloading" class="text-none mb-4" color="indigo-darken-3"
                variant="flat" block @click="handleExcelDownload">
                엑셀 다운로드
            </v-btn>
        </v-col>
    </v-row>
    <v-row>
        <v-col cols="12" md="12">
            <PageToolbar title="Users" @refresh="refresh" :closeable="false" :divider="true" :items="[ 
                   { icon: 'mdi-refresh', event: 'refresh', }]"></PageToolbar>
            <v-progress-linear v-if="downloading" :model-value="progress >= 0 ? progress : undefined"
                :indeterminate="progress < 0" class="mt-2" />
            <PageableGridContent @filter-actived="onPageableGridFilterActived" :options='{ rowSelection: rowSelection }'
                ref="pageableGridContentRef" :datasource="dataStore" :columns="columnDefs">
            </PageableGridContent>
        </v-col>
    </v-row>
</template>
<script setup lang="ts">
import GridContent from '@/components/ag-grid/GridContent.vue';
import PageableGridContent from '@/components/ag-grid/PageableGridContent.vue';
import { usePageableUsersStore } from '@/stores/studio/users.store';
import type { ColDef } from 'ag-grid-community';
import { computed, onMounted, ref } from 'vue';
import PageToolbar from '@/components/buttons/PageToolbar.vue';

// START : define pagable grid content .
const rowSelection = {
    mode: 'multiRow',
    enableClickSelection: true, 
    headerCheckbox: true,
    headerTooltip: 'Checkboxes indicate selection', 
}
const dataStore = usePageableUsersStore();
const gridData = ref<any[]>();
const loader = ref(false);
// define grid columns
const columnDefs: ColDef[] = [
    { field: 'username', headerName: '아이디', filter: false, sortable: true, type: "string", flex: 1 },
    { field: 'name', headerName: '이름', filter: false, sortable: true, type: 'string', flex: 1, },
    { field: 'email', headerName: '메일', filter: false, sortable: true, type: 'string', flex: 1, },
    { field: 'enabled', headerName: '활성화 여부', filter: false, sortable: true, type: 'boolean', flex: 1, },
    { field: 'status', headerName: '상태', filter: false, sortable: true, type: 'text', flex: 1, },
    { field: 'creationDate', headerName: '생성일시', filter: false, type: 'datetime', flex: 1 },
    { field: 'modifiedDate', headerName: '수정일시', filter: false, type: 'datetime', flex: 1 },
];
const gridContentRef = ref<InstanceType<typeof GridContent> | null>(null);
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
// END : define pagable grid content .

// START : excel downloading....
const downloading = ref(false);
const progress = ref(-1); // -1: 불확정(인디케이터)
const handleExcelDownload = async () => {
    const controller = new AbortController();
    try {
        downloading.value = true;
        progress.value = -1;
        await dataStore.downloadExcel({
            signal: controller.signal,
            download: true, // ✅ 스토어/유틸이 파일명 파싱 + 저장까지 수행
            onProgress: (p) => (progress.value = p),
        });
    } catch (e: any) {
        if (e?.name !== 'CanceledError' && e?.code !== 'ERR_CANCELED') {
            console.error('엑셀 다운로드 실패', e);
        }
    } finally {
        downloading.value = false;
    }
};
// END
onMounted(() => {

});
</script>
