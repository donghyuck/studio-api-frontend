<template>
    <v-breadcrumbs class="pa-0" :items="['응용프로그램', '자원', '템플릿']" density="compact"></v-breadcrumbs>
    <PageToolbar title="템플릿 목록" @refresh="refresh" @create="dialogs.create.visible = true;" @delete="onDeleteSelected"
        :closeable="false" :divider="true" :prepend-items="[
    ]" :items="[
        { icon: 'mdi-file-plus', event: 'create', color: 'blue', tooltip: '새로운 템픞릿 만들기' },
        { icon: 'mdi-delete', event: 'delete', color: 'error', tooltip: '선택 삭제', disabled: isDeleteDisabled },
        { icon: 'mdi-refresh', event: 'refresh', tooltip: '새로고침' }
    ]"></PageToolbar>
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
                        <v-text-field v-model="q" label="검색어" placeholder="파일 이름을 입력하세요."
                            @keydown.enter="onSearchClick" hide-details variant="outlined" density="compact">
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
    <CreateTemplateDialog v-model="dialogs.create.visible" @close="dialogs.create.visible = false"
        @complete="refresh"></CreateTemplateDialog>
</template>
<script setup lang="ts">
import PageableGridContent from '@/components/ag-grid/PageableGridContent.vue';
import PageToolbar from '@/components/bars/PageToolbar.vue';
import { useConfirm } from '@/plugins/confirm';
import { useToast } from '@/plugins/toast';
import { useNavStore } from '@/stores/studio/mgmt/nav.store';
import { usePageableTemplateStore } from '@/stores/studio/mgmt/template.store';
import type { ColDef, GridOptions, SelectionChangedEvent } from 'ag-grid-community';
import { computed, onMounted, ref } from 'vue';
import CreateTemplateDialog from './CreateTemplateDialog.vue';
import { useRouter } from 'vue-router';
import RemoteMgmtUserCellRenderer from '@/components/ag-grid/renderer/RemoteMgmtUserCellRenderer.vue';
import { deleteTemplate } from '@/data/studio/mgmt/template';
import { resolveAxiosError } from '@/utils/helpers';

const dataStore = usePageableTemplateStore();
const confirm = useConfirm();
const toast = useToast(); 
const router = useRouter();
const nav = useNavStore();
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
    { field: 'templateId', headerName: 'ID', filter: false, sortable: true, type: "number", maxWidth: 80 },
    { field: 'objectType', headerName: '유형', filter: false, type: 'number', maxWidth: 80 },
    { field: 'objectId', headerName: '식별자', filter: false, type: 'number', maxWidth: 80 },
    {
        field: 'name', headerName: '이름', filter: false, sortable: true, type: "hyperlinks", flex: 2, cellRendererParams: {
            mode: 'router',
            to: (d: any) => ({ name: 'TemplateDetails', params: { templateId: d.templateId } }),
            router: router,
        }
    },
    { field: 'displayName', headerName: '한글 이름', filter: false, sortable: true, type: "string", flex: 2 },
    { field: 'createdBy', headerName: '생성자', filter: false, type: 'number', flex: 1, cellRenderer: RemoteMgmtUserCellRenderer },
    { field: 'createdAt', headerName: '생성일시', filter: false, type: 'datetime', flex: 1 },
    { field: 'updatedBy', headerName: '수정자', filter: false, cellRenderer: RemoteMgmtUserCellRenderer, flex: 1 },
    { field: 'updatedAt', headerName: '수정일시', filter: false, type: 'datetime', flex: 1 },
];
const gridOptions: GridOptions = {
    rowSelection: { mode: 'multiRow', enableClickSelection: true },
    rowMultiSelectWithClick: true,
};
const pageableGridContentRef = ref<InstanceType<typeof PageableGridContent> | null>(null);
const filtersActive = ref(false);
const selectedCount = ref(0);
const selectedIds = ref<number[]>([]);
const isDeleteDisabled = computed(() => selectedCount.value === 0);
const gridEvents = [
    {
        type: 'selectionChanged',
        listener: (event: SelectionChangedEvent) => {
            const rows = event.api.getSelectedRows() as Array<{ templateId?: number }>;
            selectedCount.value = rows.length;
            selectedIds.value = rows
                .map((row) => Number(row.templateId))
                .filter((id) => Number.isFinite(id) && id > 0);
        },
    },
];
function onPageableGridFilterActived(event: any) {
    filtersActive.value = event;
}
const refresh = () => {
    selectedCount.value = 0;
    selectedIds.value = [];
    pageableGridContentRef.value?.refresh();
}
const onClearFilters = () => {
    pageableGridContentRef.value?.clearFilters();
};
const q = ref<string | null>(null)
const objectType = ref<number | null>(null)
const objectId = ref<number | null>(null)
// 수동 조회 버튼
function onSearchClick() {
    const params: Record<string, any> = {}
    if (q.value) {
        params.q = q.value
    }
    if (objectType.value != null) {
        params.objectType = objectType.value
    }
    if (objectId.value != null) {
        params.objectId = objectId.value
    }
    params.fields = "name,subject"
    dataStore.setFilter(params);
    refresh();
}

const dialogs = ref({
    create: { visible: false },
});

const onDeleteSelected = async () => {
    const ids = selectedIds.value;
    if (ids.length === 0) return;
    const ok = await confirm({
        title: '삭제 확인',
        message: `선택한 ${ids.length}개의 템플릿을 삭제하시겠습니까?`,
        okText: '삭제',
        cancelText: '취소',
        color: 'error',
    });
    if (!ok) return;
    try {
        await Promise.all(ids.map((id) => deleteTemplate(id)));
        toast.success('삭제 완료');
        pageableGridContentRef.value?.deselectAll();
        selectedCount.value = 0;
        selectedIds.value = [];
        refresh();
    } catch (e) {
        toast.error(resolveAxiosError(e));
    }
};

onMounted(async () => { 
    if( nav.previous?.name === 'TemplateDetails' && dataStore.page > 0){
        pageableGridContentRef.value?.goToPreviousPage();
    }
});

</script>
