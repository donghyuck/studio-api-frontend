<template>
    <v-breadcrumbs class="pa-0" :items="['응용프로그램', '자원', '파일']" density="compact"></v-breadcrumbs>
    <PageToolbar title="파일" label="모듈별 첨부 파일을 관리합니다." @refresh="refresh" :closeable="false" :divider="true"
        @upload="dialogs.upload.visible = true" :prepend-items="[
        ]" :items="[
            { icon: 'mdi-file-plus', tooltip: '새로운 파일 업로드', text: 'File Upload', variant: 'text', event: 'upload', color: 'blue', },
            { icon: 'mdi-refresh', event: 'refresh', }]"></PageToolbar>
    <v-card density="compact" class="mt-2 mb-2" variant="text">
        <v-alert closable rounded="0" icon="mdi-tooltip"
            :text="`객체 유형은 모듈 식별 아이디 값입니다. 객체 식별자는 해당 모듈에 속하는 객체 아이디 값입니다. 예를 들어 객체 유셩이 문서(1) 이라면 각 문서들의 고유한 ID 값이 객체 식별자가 됩니다.`"
            type="info" max-height="100"></v-alert>
        <v-card-actions class="px-0">
            <v-container fluid>
                <v-row>
                    <v-col cols="2">
                        <v-number-input :reverse="false" controlVariant="default" label="객체 유형" :hideInput="false" hide-details variant="outlined" density="compact"
                            :min="0" :inset="false"></v-number-input>
                    </v-col>
                    <v-col cols="2">
                        <v-number-input :reverse="false" controlVariant="default" label="객체 식별자" :hideInput="false" hide-details variant="outlined" density="compact"
                            :min="0" :inset="false"></v-number-input>
                    </v-col>
                    <v-col>
                        <v-text-field label="검색어" placeholder="파일 이름을 입력하세요." rows="1" hide-details variant="outlined" density="compact">
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
        :datasource="dataStore" :columns="columnDefs">
    </PageableGridContent>
    <FileUploadDialog v-model="dialogs.upload.visible" :attachmentId="0" @close="dialogs.upload.visible = false"
        @complete="refresh"></FileUploadDialog>
    <FileDialog v-model="dialogs.edit.visible" :attachmentId="dialogs.edit.attachmentId"
        @close="dialogs.edit.visible = false" @updated="refresh">
    </FileDialog>

</template>
<script setup lang="ts">
import PageToolbar from '@/components/buttons/PageToolbar.vue';
import { usePageableFilesStore } from '@/stores/studio/files.store';
import type { AttachmentDto } from '@/types/studio/files';
import { onMounted, ref } from 'vue';
import type { ColDef } from 'ag-grid-community';
import { formatDataSize } from '@/utils/helpers';
import PageableGridContent from '@/components/ag-grid/PageableGridContent.vue';
import { useConfirm } from '@/plugins/confirm';
import { useToast } from '@/plugins/toast';
import FileUploadDialog from './FileUploadDialog.vue';
import FileDialog from './FileDialog.vue';
import UserCellRenderer from '@/components/ag-grid/renderer/UserCellRenderer.vue';

const dataStore = usePageableFilesStore();
const confirm = useConfirm();
const toast = useToast();

// grid 
const gridData = ref<AttachmentDto[]>();
const loader = ref(false);
// define grid columns
const columnDefs: ColDef[] = [
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
    { field: 'name', headerName: '파일', filter: false, sortable: true, type: "string", flex: 2 },
    { field: 'size', headerName: '크기', filter: false, type: 'number', flex: 1, valueFormatter: formatDataSize },
    { field: 'contentType', headerName: '콘텐츠 종류', filter: false, type: 'text', flex: 1 },
    { field: 'createdBy', headerName: '생성자', filter: false, cellRenderer: UserCellRenderer, flex: 1 },
    { field: 'createdAt', headerName: '생성일시', filter: false, type: 'datetime', flex: 1 },
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

const dialogs = ref({
    upload: { visible: false },
    edit: { visible: false, attachmentId: 0 },
});

onMounted(() => {

});

</script>
