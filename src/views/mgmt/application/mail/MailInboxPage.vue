<template>
    <v-breadcrumbs class="pa-0" :items="['응용프로그램', '메일', 'INBOX']" density="compact"></v-breadcrumbs>
    <PageToolbar label="설명" @refresh="refresh" @selectAll="selectAll" :closeable="false" :divider="true" :prepend-items="[
    ]" :items="[ 
        { icon: 'mdi-format-list-checkbox', event: 'selectAll', tooltip: selectAllToolTip }, 
        { icon: 'mdi-refresh', event: 'refresh', }]"></PageToolbar>
    <v-card density="compact" variant="text" class="mt-1" v-expand-transition>
        <v-card-actions class="pa-0">
                <v-text-field density="compact" variant="outlined" label="검색어" placeholder="검색어를 입력하세요." row-height="15" rows="2" hide-details>
                    <template v-slot:append>
                        <v-btn icon="mdi-text-search" variant="text"></v-btn>
                    </template>
                </v-text-field> 
        </v-card-actions>
    </v-card>
    <PageableGridContent class="mt-1" @filter-actived="onPageableGridFilterActived" ref="pageableGridContentRef" :colIdToSnakeCase="false"
        :options='{ rowSelection: rowSelection , cellSelection: true}'
        :datasource="dataStore" :columns="columnDefs">
    </PageableGridContent>
    <v-overlay v-model="overlay" contained class="align-center justify-center">
        <v-progress-circular color="primary" indeterminate size="64" />
    </v-overlay>    
</template>
<script setup lang="ts">
import PageToolbar from '@/components/buttons/PageToolbar.vue';
import { useConfirm } from '@/plugins/confirm';
import { useToast } from '@/plugins/toast';
import { usePageableMailInboxStore } from '@/stores/studio/mail.inbox.store';
import { computed, ref } from 'vue';
import type { ColDef, RowSelectionOptions } from 'ag-grid-community';
import PageableGridContent from '@/components/ag-grid/PageableGridContent.vue';
import MailAddressCellRenderer from '@/components/ag-grid/renderer/MailAddressCellRenderer.vue';

const confirm = useConfirm();
const toast = useToast()
const overlay = ref<boolean>(false);
const show = ref<boolean>(false)
    
// grid     
const dataStore = usePageableMailInboxStore();
const rowSelection: RowSelectionOptions = {
    mode: 'multiRow',
    enableClickSelection: false,
    headerCheckbox: true,
}
const columnDefs: ColDef[] = [ 
    { field: 'fromAddress', headerName: '보낸 사람', filter: false, type: "text", flex: .5 , cellRenderer: MailAddressCellRenderer},
    { field: 'folder', headerName: '폴더', filter: false, type: "text", flex: .25 },
    { field: 'subject', headerName: '제목', filter: false, type: "text", flex: 1},
    { field: 'sentAt', headerName: '발송일', filter: false, type: "datetime", flex: .4 },
    { field: 'receivedAt', headerName: '수신일', filter: false, type: 'datetime', flex: .4 }, 
];

const pageableGridContentRef = ref<InstanceType<typeof PageableGridContent> | null>(null);
const filtersActive = ref(false);
const selectedRows = computed(() => pageableGridContentRef.value?.selectedRows() || []);

function onPageableGridFilterActived(event: any) {
    filtersActive.value = event;
}

const refresh = () => {
    pageableGridContentRef.value?.refresh();
}
const selectAll = () => {
    if(selectedRows.value.length>0)
        pageableGridContentRef.value?.deselectAll();
    else
        pageableGridContentRef.value?.selectAll();
}
const selectAllToolTip = computed(() => selectedRows.value.length>0 ? "선택 해제":  "전체 선택");

const onClearFilters = () => {
    pageableGridContentRef.value?.clearFilters();
};
</script>
