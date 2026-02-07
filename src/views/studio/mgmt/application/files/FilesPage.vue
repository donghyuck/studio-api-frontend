<template>
    <v-breadcrumbs class="pa-0" :items="['응용프로그램', '자원', '파일']" density="compact"></v-breadcrumbs>
    <PageToolbar title="파일" label="모듈별 첨부 파일을 관리합니다." @refresh="refresh" @delete="onDeleteSelected"
        :closeable="false" :divider="true" @upload="dialogs.upload.visible = true" :prepend-items="[
        ]" :items="[
            { icon: 'mdi-file-plus', tooltip: '새로운 파일 업로드', text: 'File Upload', variant: 'text', event: 'upload', color: 'blue', },
            { icon: 'mdi-delete', event: 'delete', color: 'error', tooltip: '선택 삭제', disabled:isDeleteDisabled },
            { icon: 'mdi-refresh', event: 'refresh', }]"></PageToolbar>
    <v-card density="compact" class="mt-1" variant="text">
        <v-alert closable rounded="0" icon="mdi-tooltip" class="mb-2 text-body-2"
            :text="`객체 유형은 모듈 식별 아이디 값입니다. 객체 식별자는 해당 모듈에 속하는 객체 아이디 값입니다. 예를 들어 객체 유셩이 문서(1) 이라면 각 문서들의 고유한 ID 값이 객체 식별자가 됩니다.`"
            type="info" max-height="100"></v-alert>
        <v-card-actions class="pa-0">
            <v-container fluid class="pa-0">
                <v-row>
                    <v-col cols="2">
                        <v-number-input v-model="objectType" :reverse="false" controlVariant="default" label="객체 유형" :hideInput="false"
                            hide-details variant="outlined" density="compact" :min="0" :inset="false"></v-number-input>
                    </v-col>
                    <v-col cols="2">
                        <v-number-input v-model="objectId" :reverse="false" controlVariant="default" label="객체 식별자" :hideInput="false"
                            hide-details variant="outlined" density="compact" :min="0" :inset="false"></v-number-input>
                    </v-col>
                    <v-col>
                        <v-text-field v-model="q" label="검색어" placeholder="파일 이름을 입력하세요." @keydown.enter="onSearchClick" hide-details variant="outlined"
                            density="compact">
                            <template v-slot:append>
                                <v-btn icon="mdi-text-search" variant="tonal"></v-btn>
                            </template>
                        </v-text-field>
                    </v-col>
                </v-row>
            </v-container>
        </v-card-actions>
    </v-card>
    <PageableGridContent ref="pageableGridContentRef" @filter-actived="onPageableGridFilterActived"
        :datasource="dataStore" :columns="columnDefs" :options="gridOptions" :events="gridEvents">
    </PageableGridContent>
    <FileUploadDialog v-model="dialogs.upload.visible" :attachmentId="0" @close="dialogs.upload.visible = false"
        @complete="refresh"></FileUploadDialog>
    <FileDialog v-model="dialogs.edit.visible" :attachmentId="dialogs.edit.attachmentId"
        @close="dialogs.edit.visible = false" @updated="refresh">
    </FileDialog>

</template>
<script setup lang="ts">
import PageToolbar from '@/components/bars/PageToolbar.vue';
import { usePageableFilesStore } from '@/stores/studio/mgmt/files.store';
import type { AttachmentDto } from '@/types/studio/files';
import { computed, onMounted, ref } from 'vue';
import type { ColDef, GridOptions, SelectionChangedEvent } from 'ag-grid-community';
import { formatDataSize } from '@/utils/helpers';
import PageableGridContent from '@/components/ag-grid/PageableGridContent.vue';
import { useConfirm } from '@/plugins/confirm';
import { useToast } from '@/plugins/toast';
import FileUploadDialog from './FileUploadDialog.vue';
import FileDialog from './FileDialog.vue';
import UserCellRenderer from '@/components/ag-grid/renderer/UserCellRenderer.vue';
import { useNavStore } from '@/stores/studio/mgmt/nav.store';
import { deleteFileById } from '@/data/studio/mgmt/files';
import { resolveAxiosError } from '@/utils/helpers';

const dataStore = usePageableFilesStore();
const confirm = useConfirm();
const toast = useToast();
const nav = useNavStore();

// grid 
const gridData = ref<AttachmentDto[]>();
const loader = ref(false);
// define grid columns
const columnDefs: ColDef[] = [
    {
        headerName: '',
        field: 'select',
        maxWidth: 48,
        pinned: 'left',
        sortable: false,
        filter: false,
        resizable: false,
        checkboxSelection: true,
        headerCheckboxSelection: true,
        headerCheckboxSelectionFilteredOnly: true,
    },
    { field: 'attachmentId', headerName: 'ID', filter: false, sortable: true, type: "number", maxWidth: 100 },
    {
        field: 'name', headerName: '파일', filter: false, sortable: true, type: "hyperlinks", flex: 2, cellRendererParams: {
            mode: 'callback',
            labelClassName: "ag-link__label hover:underline",
            onClick: async (row: AttachmentDto) => {
                dialogs.value.edit.attachmentId = row.attachmentId;
                dialogs.value.edit.visible = true;
            },
        }
    }, 
    { field: 'size', headerName: '크기', filter: false, type: 'number', flex: 1, valueFormatter: formatDataSize },
    { field: 'contentType', headerName: '콘텐츠 종류', filter: false, type: 'text', flex: 1 },
    { field: 'createdBy', headerName: '생성자', filter: false, cellRenderer: UserCellRenderer, flex: 1 },
    { field: 'createdAt', headerName: '생성일시', filter: false, type: 'datetime', flex: 1 },
];
const gridOptions: GridOptions = {
    rowSelection: 'multiple',
    rowMultiSelectWithClick: true,
    suppressRowClickSelection: false,
};
const pageableGridContentRef = ref<InstanceType<typeof PageableGridContent> | null>(null);
const filtersActive = ref(false);
const selectedCount = ref(0);
const selectedIds = ref<number[]>([]);
const gridEvents = [
    {
        type: 'selectionChanged',
        listener: (event: SelectionChangedEvent) => {
            const rows = event.api.getSelectedRows() as Array<{ attachmentId?: number }>;
            selectedCount.value = rows.length;
            selectedIds.value = rows
                .map((row) => Number(row.attachmentId))
                .filter((id) => Number.isFinite(id) && id > 0);
        },
    },
];
const isDeleteDisabled = computed(() => selectedCount.value === 0);
function onPageableGridFilterActived(event: any) {
    filtersActive.value = event;
}
const refresh = () => {
    pageableGridContentRef.value?.refresh();
}
const onClearFilters = () => {
    pageableGridContentRef.value?.clearFilters();
};

const dialogs = ref({
    upload: { visible: false },
    edit: { visible: false, attachmentId: 0 },
});

const onDeleteSelected = async () => {
    const ids = selectedIds.value;
    if (ids.length === 0) return;
    const ok = await confirm({
        title: '삭제 확인',
        message: `선택한 ${ids.length}개의 파일을 삭제하시겠습니까?`,
        okText: '삭제',
        cancelText: '취소',
        color: 'error',
    });
    if (!ok) return;
    try {
        await Promise.all(ids.map((id) => deleteFileById(id)));
        toast.success('삭제 완료');
        pageableGridContentRef.value?.deselectAll();
        refresh();
    } catch (e) {
        toast.error(resolveAxiosError(e));
    }
};

const q = ref<string | null>(null) 
const objectType = ref<number | null>(null)
const objectId = ref<number | null>(null) 
// 수동 조회 버튼
function onSearchClick() {
    const params: Record<string, any> = {}
    if (q.value) {
        params.keyword = q.value
    }
    if (objectType.value != null) {
        params.objectType = objectType.value
    }
    if (objectId.value != null) {
        params.objectId = objectId.value
    }
    dataStore.setFilter(params);
    refresh();
}

onMounted(() => {
    if( nav.previous?.name === 'FileDetails' && dataStore.page > 0){
        pageableGridContentRef.value?.goToPreviousPage();
    }
});

</script>
