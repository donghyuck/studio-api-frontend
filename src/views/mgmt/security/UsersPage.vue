<template>
    <v-breadcrumbs class="pa-0" :items="['시스템관리', '보안관리', '회원']" density="compact"></v-breadcrumbs>
    <PageToolbar title="Users" @refresh="refresh" @download-excel-all="handleExcelDownload" :closeable="false"
        :divider="false" :items="[
            { icon: 'mdi-download', event: 'download-excel-all', variant: 'text', tooltip: '엑셀 다운로드',  disabled: downloading },
            { icon: 'mdi-account-plus', event: 'create', color: 'blue', variant: 'text', tooltip: '회원 등록' },
            { icon: 'mdi-refresh', event: 'refresh', variant: 'text' }]"></PageToolbar>
    <v-row>
        <v-col cols="12" md="12">
            <v-progress-linear v-if="downloading" :model-value="progress >= 0 ? progress : undefined"
                :indeterminate="progress < 0" class="mt-2" />
            <PageableGridContent @filter-actived="onPageableGridFilterActived" :colIdToSnakeCase="false"
                :options='{ rowSelection: rowSelection , cellSelection: true}' ref="pageableGridContentRef" :datasource="dataStore"  
                :columns="columnDefs">
            </PageableGridContent>
        </v-col>
    </v-row>
</template>
<script setup lang="ts">
import GridContent from '@/components/ag-grid/GridContent.vue';
import PageableGridContent from '@/components/ag-grid/PageableGridContent.vue';
import ActionCellRenderer from '@/components/ag-grid/renderer/ActionCellRenderer.vue';
import CheckboxRenderer from '@/components/ag-grid/renderer/CheckboxRenderer.vue';
import PageToolbar from '@/components/buttons/PageToolbar.vue';
import { useNavStore } from '@/stores/studio/nav.store';
import { usePageableUsersStore } from '@/stores/studio/users.store';
import type { ColDef, RowSelectionOptions } from 'ag-grid-community';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const nav = useNavStore();

// START : define pagable grid content .
const rowSelection: RowSelectionOptions = {
    mode: 'multiRow',
    enableClickSelection: false,
    headerCheckbox: true,
}
const dataStore = usePageableUsersStore();
const gridData = ref<any[]>();
const loader = ref(false);
const router = useRouter();
// define grid columns
function onAction({ action, row }: { action: string; row: any }) {
    if (action === 'view') {
        router.push({ name: 'UserDetails', params: { userId: row.userId } })
    } else if (action === 'delete') {
        if (confirm(`'${row.name}' 을 삭제할까요?`)) {
            //store.remove(row.groupId).then(() => refresh())
        }
    }
}
const columnActions = [
    {
        label: '삭제',
        variant: 'outlined',
        prependIcon: 'mdi-delete',
        color: 'red',
        event: 'delete',
        tooltip: '회원을 삭제합니다.',
        visible: true,
    },
    {
        label: '상세보기',
        icon: 'mdi-chevron-right',
        event: 'view',
        visible: true,
        disabled: false,
    }
];

const columnDefs: ColDef[] = [
    {
        field: 'username', headerName: '아이디', filter: false, sortable: true, type: "hyperlinks", flex: .8, cellRendererParams: {
            mode: 'router',
            to: (d: any) => ({ name: 'UserDetails', params: { userId: d.userId } }),
            router: router,
        }
    },
    { field: 'name', headerName: '이름', filter: false, sortable: true, type: "hyperlinks", flex: .8 },
    { field: 'email', headerName: '메일', filter: false, sortable: true, type: 'string', flex: 1, },
    { field: 'enabled', headerName: '활성화 여부', filter: false, sortable: true, type: 'boolean', flex: .5, cellRenderer: CheckboxRenderer, cellStyle: { textAlign: "center" }, },
    { field: 'status', headerName: '상태', filter: false, sortable: true, type: 'text', flex: .5, },
    { field: 'creationDate', headerName: '생성일시', filter: false, type: 'datetime', flex: 1 },
    { field: 'modifiedDate', headerName: '수정일시', filter: false, type: 'datetime', flex: 1 },
    { colId: 'actions', headerName: '', filter: false, sortable: false, flex: 1, cellRenderer: ActionCellRenderer, cellRendererParams: { actions: columnActions, onAction } },
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
onMounted(async () => { 
    if( nav.previous?.name === 'UserDetails' && dataStore.page > 0){
        pageableGridContentRef.value?.goToPreviousPage();
    }
});
</script>
