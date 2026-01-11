<template>
    <v-breadcrumbs class="pa-0" :items="['시스템관리', '보안관리', '회원']" density="compact"></v-breadcrumbs>
    <PageToolbar title="회원 목록" @refresh="refresh" @download-excel-all="handleExcelDownload" @selectAll="selectAll"
        :closeable="false" :divider="true" :items="[
            { icon: 'mdi-download', event: 'download-excel-all', variant: 'text', tooltip: '엑셀 다운로드',  disabled: downloading },
            { icon: 'mdi-account-plus', event: 'create', color: 'blue', variant: 'text', tooltip: '회원 등록' },
            { icon: 'mdi-format-list-checkbox', event: 'selectAll', variant: 'text', tooltip: selectAllToolTip },
            { icon: 'mdi-refresh', event: 'refresh', variant: 'text' }]"></PageToolbar>
    <v-card density="compact" class="mt-1" variant="text">
        <v-card-actions class="pa-0">
            <v-text-field v-model="q" density="compact" variant="outlined" label="검색어"
                placeholder="아이디 또는 이름을 입력하세요." @keydown.enter="onSearchClick" hide-details>
                <template v-slot:append>
                    <v-btn icon="mdi-text-search" variant="text" @click="onSearchClick"></v-btn>
                </template>
            </v-text-field>
        </v-card-actions>
    </v-card>
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
    <UserRolesDialog v-model="dialog_user_roles.visible" :userId="dialog_user_roles.userId" @updated="refresh" />
</template>
<script setup lang="ts">
import GridContent from '@/components/ag-grid/GridContent.vue';
import PageableGridContent from '@/components/ag-grid/PageableGridContent.vue';
import ActionCellRenderer from '@/components/ag-grid/renderer/ActionCellRenderer.vue';
import CheckboxRenderer from '@/components/ag-grid/renderer/CheckboxRenderer.vue';
import PageToolbar from '@/components/bars/PageToolbar.vue';
import { useNavStore } from '@/stores/studio/nav.store';
import { usePageableUsersStore } from '@/stores/studio/users.store';
import type { ColDef, RowSelectionOptions } from 'ag-grid-community';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import UserRolesDialog from '@/views/mgmt/security/UserRolesDialog.vue';

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

const dialog_user_roles = ref({
    visible: false, userId: 0 
});
// define grid columns
function onAction({ action, row }: { action: string; row: any }) {
    
    if (action === 'view') {
        router.push({ name: 'UserDetails', params: { userId: row.userId } })
    } else if (action === 'roles') {
        dialog_user_roles.value.userId = row.userId;
        dialog_user_roles.value.visible = true;
    } else if (action === 'delete') {
        if (confirm(`'${row.name}' 을 삭제할까요?`)) {
            //store.remove(row.groupId).then(() => refresh())
        }
    }
}
const columnActions = [
    {
        label: '권한',
        variant: 'text',
        prependIcon:  'mdi-shield-account',
        color: 'blue',
        event: 'roles',
        visible: true,
        tooltip: '사용자 권한을 변경합니다.',
    },
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
    { colId: 'actions', headerName: '', filter: false, sortable: false, flex: 1.1, cellRenderer: ActionCellRenderer, cellRendererParams: {
        actions: columnActions, onAction } },
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
const selectAll = () => {
    if (selectedRows.value.length > 0)
        pageableGridContentRef.value?.deselectAll();
    else
        pageableGridContentRef.value?.selectAll();
}
const selectAllToolTip = computed(() => selectedRows.value.length > 0 ? "선택 해제" : "전체 선택");
const q = ref<string | null>(null);
const onSearchClick = () => {
    const params: Record<string, any> = {};
    if (q.value && q.value.trim().length > 0) {
        params.q = q.value.trim();
        params.in = "username,name,email";
    }
    dataStore.setFilter(params);
    refresh();
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
onMounted(async () => { 
    if( nav.previous?.name === 'UserDetails' && dataStore.page > 0){
        pageableGridContentRef.value?.goToPreviousPage();
    }
});
</script>
