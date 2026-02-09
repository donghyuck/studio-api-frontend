<template>
    <v-breadcrumbs class="pa-0" :items="['응용프로그램', '메일', 'INBOX']" density="compact"></v-breadcrumbs>
    <PageToolbar label="설명" @refresh="refresh" @selectAll="selectAll" @delete="onDeleteSelected"
        :closeable="false" :divider="true" :prepend-items="[
    ]" :items="[
        { icon: 'mdi-format-list-checkbox', event: 'selectAll', tooltip: selectAllToolTip },
        { icon: 'mdi-delete', event: 'delete', color: 'error', tooltip: '선택 삭제', disabled:isDeleteDisabled },
        { icon: 'mdi-refresh', event: 'refresh', }]"></PageToolbar>
    <v-card density="compact" variant="text" class="mt-1" v-expand-transition>
        <v-card-actions class="pa-0">
            <v-text-field v-model="q" density="compact" variant="outlined" label="검색어" placeholder="검색어를 입력하세요."
                row-height="15" rows="2" hide-details>
                <template v-slot:append>
                    <v-btn icon="mdi-text-search" variant="text" @keydown.enter="onSearchClick" @click="onSearchClick"></v-btn>
                </template>
            </v-text-field>
        </v-card-actions>
    </v-card>
    <PageableGridContent class="mt-1" @filter-actived="onPageableGridFilterActived" ref="pageableGridContentRef"
        :colIdToSnakeCase="false" :options='{ rowSelection: rowSelection }' :datasource="dataStore"
        :columns="columnDefs" :events="gridEvents">
    </PageableGridContent>
    <v-overlay v-model="overlay" contained class="align-center justify-center">
        <v-progress-circular color="primary" indeterminate size="64" />
    </v-overlay>
</template>
<script setup lang="ts">
import PageToolbar from '@/components/bars/PageToolbar.vue';
import { useConfirm } from '@/plugins/confirm';
import { useToast } from '@/plugins/toast';
import { usePageableMailInboxStore } from '@/stores/studio/mgmt/mail.inbox.store';
import { computed, onMounted, ref } from 'vue';
import type { ColDef, RowSelectionOptions, SelectionChangedEvent } from 'ag-grid-community';
import PageableGridContent from '@/components/ag-grid/PageableGridContent.vue';
import MailAddressCellRenderer from '@/components/ag-grid/renderer/MailAddressCellRenderer.vue';
import { useRouter } from 'vue-router';
import { useNavStore } from '@/stores/studio/mgmt/nav.store';
import { deleteMail } from '@/data/studio/mgmt/mail';
import { resolveAxiosError } from '@/utils/helpers';

const confirm = useConfirm();
const toast = useToast()
const overlay = ref<boolean>(false);
const show = ref<boolean>(false)
const router = useRouter();
const nav = useNavStore();

// grid     
const dataStore = usePageableMailInboxStore();
const rowSelection: RowSelectionOptions = {
    mode: 'multiRow',
    enableClickSelection: false,
};
const columnDefs: ColDef[] = [
    { field: 'fromAddress', headerName: '보낸 사람', filter: false, type: "text", flex: .5, cellRenderer: MailAddressCellRenderer },
    { field: 'folder', headerName: '폴더', filter: false, type: "text", flex: .25 },
    {
        field: 'subject', headerName: '제목', filter: false, sortable: true, type: "hyperlinks", flex: 1, cellRendererParams: {
            mode: 'router',
            to: (d: any) => ({ name: 'MailDetails', params: { mailId: d.mailId } }),
            router: router,
        }
    },
    { field: 'sentAt', headerName: '발송일', filter: false, type: "datetime", flex: .4 },
    { field: 'receivedAt', headerName: '수신일', filter: false, type: 'datetime', flex: .4 },
];

const pageableGridContentRef = ref<InstanceType<typeof PageableGridContent> | null>(null);
const filtersActive = ref(false);
const selectedRows = ref<any[]>([]);
const selectedIds = computed(() =>
    selectedRows.value
        .map((row: any) => Number(row.mailId))
        .filter((id: number) => Number.isFinite(id) && id > 0)
);
const isDeleteDisabled = computed(() => selectedIds.value.length === 0);
const gridEvents = [
    {
        type: 'selectionChanged',
        listener: (event: SelectionChangedEvent) => {
            selectedRows.value = event.api.getSelectedRows() as any[];
        },
    },
];
const q = ref<string | null>(null) // 'YYYY-MM-DD'
function onSearchClick() {
    if (!q.value) return
    const params: Record<string, any> = {}
    params.q = q.value
    params.fields = "fromAddress,toAddress,subject,body" 
    dataStore.setFilter(params);
    refresh();
}

function onPageableGridFilterActived(event: any) {
    filtersActive.value = event;
}

const refresh = () => {
    pageableGridContentRef.value?.refresh();
}
const selectAll = () => {
    if (selectedRows.value.length > 0)
        pageableGridContentRef.value?.deselectAll();
    else
        pageableGridContentRef.value?.selectAll();
}
const selectAllToolTip = computed(() => selectedRows.value.length > 0 ? "선택 해제" : "전체 선택");

const onClearFilters = () => {
    pageableGridContentRef.value?.clearFilters();
};

const onDeleteSelected = async () => {
    const ids = selectedIds.value;
    if (ids.length === 0) return;
    const ok = await confirm({
        title: '삭제 확인',
        message: `선택한 ${ids.length}개의 메일을 삭제하시겠습니까?`,
        okText: '삭제',
        cancelText: '취소',
        color: 'error',
    });
    if (!ok) return;
    overlay.value = true;
    try {
        await Promise.all(ids.map((id) => deleteMail(id)));
        toast.success('삭제 완료');
        pageableGridContentRef.value?.deselectAll();
        refresh();
    } catch (e) {
        toast.error(resolveAxiosError(e));
    } finally {
        overlay.value = false;
    }
};

onMounted(async () => { 
    if( nav.previous?.name === 'MailDetails' && dataStore.page > 0){
        pageableGridContentRef.value?.goToPreviousPage();
    }
});
</script>
