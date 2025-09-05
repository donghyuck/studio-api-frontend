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
            <v-progress-linear v-if="downloading" :model-value="progress >= 0 ? progress : undefined"
                :indeterminate="progress < 0" class="mt-2" />
            <PageableGridContent @filter-actived="onPageableGridFilterActived" ref="pageableGridContentRef"
                :datasource="dataStore" :columns="columnDefs">
            </PageableGridContent>
        </v-col>
    </v-row>
</template>
<script setup lang="ts">
import GridContent from '@/components/ag-grid/GridContent.vue';
import PageableGridContent from '@/components/ag-grid/PageableGridContent.vue';
import { onMounted, ref } from 'vue';
import type { ColDef } from 'ag-grid-community';
import { usePageableUsersStore } from '@/stores/pem/users.store';

// START : define pagable grid content .
const dataStore = usePageableUsersStore();
const gridData = ref<any[]>();
const loader = ref(false);
// define grid columns
const columnDefs: ColDef[] = [
    { field: 'username', headerName: '아이디', filter: false, sortable: true, type: "string", flex: 1 },
    { field: 'name', headerName: '이름', filter: false, sortable: false, type: 'string', flex: 1, },
    { field: 'email', headerName: '메일', filter: false, sortable: false, type: 'string', flex: 1, },
    { field: 'enabled', headerName: '활성화 여부', filter: false, sortable: false, type: 'boolean', flex: 1, },
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
