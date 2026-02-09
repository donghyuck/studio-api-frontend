<template>
    <v-breadcrumbs class="pa-0" :items="['응용프로그램', '자원', '문서']" density="compact"></v-breadcrumbs>
    <PageToolbar title="문서 목록" label="문서 목록을 보여줍니다." @create="dialogs.create.visible = true;" @refresh="refresh"
        @preview="openPreview" :closeable="false" :divider="true" :prepend-items="[
        ]" :items="[
            { icon: 'mdi-file-plus', event: 'create', color: 'blue', tooltip: '새로운 문서 만들기' },
            {
                icon: 'mdi-eye-outline', event: 'preview', color: 'red', tooltip: '선택한 문서 미리보기',
                disabled: isPreviewDisabled, tooltipWhenDisabled: '문서 1건을 선택하세요.'
            },
            { icon: 'mdi-refresh', event: 'refresh', }]"></PageToolbar>
    <v-card density="compact" class="mt-1" variant="text">
        <v-card-actions class="pa-0">
            <v-container fluid class="pa-0">
                <v-row>
                    <v-col cols="2">
                        <v-number-input v-model="objectType" :reverse="false" controlVariant="default" label="객체 유형"
                            :hideInput="false" hide-details variant="outlined" density="compact" :min="0"
                            :inset="false"></v-number-input>
                    </v-col>
                    <v-col cols="2">
                        <v-number-input v-model="objectId" :reverse="false" controlVariant="default" label="객체 식별자"
                            :hideInput="false" hide-details variant="outlined" density="compact" :min="0"
                            :inset="false"></v-number-input>
                    </v-col>
                    <v-col>
                        <v-text-field v-model="q" label="검색어" placeholder="파일 이름을 입력하세요." @keydown.enter="onSearchClick"
                            hide-details variant="outlined" density="compact">
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
    <CreateDocumentDialog v-model="dialogs.create.visible" @close="dialogs.create.visible = false" @complete="refresh">
    </CreateDocumentDialog>
    <DocumentPreviewDialog v-model="dialogs.preview.visible" :document-id="dialogs.preview.documentId"
        :title="dialogs.preview.title" />
</template>
<script setup lang="ts">
import PageToolbar from '@/components/bars/PageToolbar.vue';
import { useConfirm } from '@/plugins/confirm';
import { useToast } from '@/plugins/toast';
import { usePageableDocumentListStore } from '@/stores/studio/mgmt/document.list.store';
import { useNavStore } from '@/stores/studio/mgmt/nav.store';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import PageableGridContent from '@/components/ag-grid/PageableGridContent.vue';
import type { ColDef, GridOptions, SelectionChangedEvent } from 'ag-grid-community';
import RemoteMgmtUserCellRenderer from '@/components/ag-grid/renderer/RemoteMgmtUserCellRenderer.vue';
import CreateDocumentDialog from './CreateDocumentDialog.vue';
import DocumentPreviewDialog from './DocumentPreviewDialog.vue';

const confirm = useConfirm();
const toast = useToast();
const router = useRouter();
const nav = useNavStore();

const dataStore = usePageableDocumentListStore();
// Grid
const columnDefs: ColDef[] = [
    {
        headerName: '',
        field: 'select',
        maxWidth: 65,
        pinned: 'left',
        sortable: false,
        filter: false,
        resizable: false,
        checkboxSelection: true,
        headerCheckboxSelection: false,
    },
    { field: 'documentId', headerName: 'ID', filter: false, sortable: true, type: "number", maxWidth: 80 },
    { field: 'objectType', headerName: '유형', filter: false, type: 'number', maxWidth: 80 },
    { field: 'objectId', headerName: '식별자', filter: false, type: 'number', maxWidth: 80 },
    {
        field: 'name', headerName: '이름', filter: false, sortable: true, type: "hyperlinks", flex: 1, cellRendererParams: {
            mode: 'router',
            to: (d: any) => ({ name: 'DocumentEditor', params: { documentId: d.documentId } }),
            router: router,
        }
    },
    { field: 'title', headerName: '주제', filter: false, sortable: true, type: "string", flex: 2 },
    { field: 'latestVersionId', headerName: '버전', filter: false, type: 'number', maxWidth: 80 },
    { field: 'createdBy', headerName: '생성자', filter: false, type: 'number', flex: 1, cellRenderer: RemoteMgmtUserCellRenderer },
    { field: 'createdAt', headerName: '생성일시', filter: false, type: 'datetime', flex: 1 },
    { field: 'updatedBy', headerName: '수정자', filter: false, cellRenderer: RemoteMgmtUserCellRenderer, flex: 1 },
    { field: 'updatedAt', headerName: '수정일시', filter: false, type: 'datetime', flex: 1 },
];
const gridOptions: GridOptions = {
    rowSelection: { mode: 'singleRow', enableClickSelection: true },
    rowMultiSelectWithClick: false,
};

const pageableGridContentRef = ref<InstanceType<typeof PageableGridContent> | null>(null);
const filtersActive = ref(false);
const selectedCount = ref(0);
const selectedIds = ref<number[]>([]);
const selectedTitle = ref<string | null>(null);
const isDeleteDisabled = computed(() => selectedCount.value === 0);
const isPreviewDisabled = computed(() => selectedCount.value !== 1);
const gridEvents = [
    {
        type: 'selectionChanged',
        listener: (event: SelectionChangedEvent) => {
            const rows = event.api.getSelectedRows() as Array<{ documentId?: number; title?: string }>;
            selectedCount.value = rows.length;
            selectedIds.value = rows
                .map((row) => Number(row.documentId))
                .filter((id) => Number.isFinite(id) && id > 0);
            selectedTitle.value = rows.length === 1 ? rows[0]?.title ?? null : null;
        },
    },
];
function onPageableGridFilterActived(event: any) {
    filtersActive.value = event;
}
const refresh = () => {
    selectedCount.value = 0;
    selectedIds.value = [];
    selectedTitle.value = null;
    pageableGridContentRef.value?.refresh();
}

const q = ref<string | null>(null)
const objectType = ref<number | null>(null)
const objectId = ref<number | null>(null)

// 수동 조회 버튼
function onSearchClick() {
    const params: Record<string, any> = {}
    if (q.value) {
        params.q = q.value
    }
    const hasObjectType = objectType.value != null && objectType.value > 0
    const hasObjectId = objectId.value != null && objectId.value > 0
    if (hasObjectType !== hasObjectId) {
        toast.error('objectType와 objectId는 함께 입력해야 합니다.')
        return
    }
    if (hasObjectType && hasObjectId) {
        params.objectType = objectType.value
        params.objectId = objectId.value
    }
    dataStore.setFilter(params);
    refresh();
}

const dialogs = ref({
    create: { visible: false },
    preview: { visible: false, documentId: null as number | null, title: null as string | null },
});

const openPreview = () => {
    if (selectedIds.value.length !== 1) {
        toast.error('문서 1건을 선택하세요.');
        return;
    }
    dialogs.value.preview.documentId = selectedIds.value[0];
    dialogs.value.preview.title = selectedTitle.value;
    dialogs.value.preview.visible = true;
};

onMounted(async () => {
    if (nav.previous?.name === 'TemplateDetails' && dataStore.page > 0) {
        pageableGridContentRef.value?.goToPreviousPage();
    }
});
</script>
