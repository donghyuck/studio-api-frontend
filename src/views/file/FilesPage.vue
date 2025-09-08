<template>
    <v-container>
        <v-row>
            <v-col>
                <v-card title="업로드된 파일 목록" variant="outlined">
                    <v-card-text>
                        업로드된 파일 목록을 보여줍니다.
                    </v-card-text>
                    <v-card-text>
                        <v-row>
                            <v-col cols="12" md="4">
                                <v-text-field clearable label="모듈명" v-model="uploadMeta.module"
                                    placeholder="예: board"></v-text-field>
                            </v-col>
                            <v-col cols="12" md="4">
                                <v-text-field clearable label="참조 객체 아이디" v-model="uploadMeta.refId"
                                    placeholder="예: 게시물 ID"></v-text-field>
                            </v-col>
                        </v-row>
                    </v-card-text>
                    <v-card-actions>
                         <v-spacer></v-spacer>
                        <v-btn color="primary" class="mt-4"
                            @click="getData(true)">
                            검색
                        </v-btn>
                    </v-card-actions>
                </v-card>
            </v-col>
        </v-row>
        <v-row>
            <v-col cols="12" md="12">
                <GridContent ref="gridContentRef" 
                    :rowData="gridData" :rowSelection="'single'"
                    @row-selected="onRowSelected" 
                    style="" :auto-resize="false" :columns="columnDefs"
                    :events="[
                        { type: 'buttonCellRenderer:download', listener: handleDownload },
                        { type: 'buttonCellRenderer:delete', listener: handleDelete }
                    ]">
                </GridContent>
            </v-col>
        </v-row>
    </v-container>
</template>
<script setup lang="ts">
import GridContent from '@/components/ag-grid/GridContent.vue';
import { onMounted, ref } from 'vue';
import type { ColDef } from 'ag-grid-community';
import { usePageableFilesStore } from '@/stores/studio/files.store';
import type { UploadMeta, UploadResult } from "@/types/upload"; 
import { formatDataSize } from "@/utils/helpers";  
import ButtonCellRenderer from '@/components/ag-grid/renderer/ButtonCellRenderer.vue';

const fileStore = usePageableFilesStore();
const uploadMeta: UploadMeta = {
    module: "board",
    refId: "12345", 
};

// grid 
const gridData = ref<any[]>();
const loader = ref(false);
// define grid columns
const columnDefs: ColDef[] = [
    { field: 'id', headerName: 'ID', filter: false, sortable: true, type: "number", flex: 1 },
    { field: 'originalName', headerName: '이름', filter: false, sortable: true, type: "string", flex: 2 },
    { field: 'size', headerName: '크기', filter: false, type: 'number', flex: 1, valueFormatter: formatDataSize },
    { field: 'contentType', headerName: '콘텐츠 종류', filter: false, type: 'text', flex: 1 },
    { field: 'createdAt', headerName: '생성일시', filter: false, type: 'datetime', flex: 1 },
    { field: 'id', headerName: '', filter: false, sortable:false, flex: 1.5, cellRenderer:ButtonCellRenderer , cellRendererParams: { downloadable: true, deletable : true} },
];

const gridContentRef = ref<InstanceType<typeof GridContent> | null>(null);
const onRowSelected = (event: any) => {
    if (event.node.selected) {
        const selectedData = event.node.data;
    }
};

async function getData(force: boolean = false) {
    loader.value = true;
    if (force || !fileStore.isLoaded){
        fileStore.setFilter(uploadMeta);
        await fileStore.fetch(); 
    }
    gridData.value = [...fileStore.dataItems];
    loader.value = false;
}

async function handleDownload( event : any ){ 
     fileStore.download(event.data);
     const controller = new AbortController();
     const progress = ref(-1); // -1: 불확정(인디케이터)
    try {
        await fileStore.download(
            event.data , 
            {
            signal: controller.signal,
            download: true, // ✅ 스토어/유틸이 파일명 파싱 + 저장까지 수행
            onProgress: (p) => (progress.value = p),
        });
    } catch (e: any) {
        if (e?.name !== 'CanceledError' && e?.code !== 'ERR_CANCELED') {
            console.error('엑셀 다운로드 실패', e);
        }
    }
}

async function handleDelete( event : any ){ 
    await fileStore.deleteById( event.data.id );
    getData(true);
}

onMounted(() => {
    getData(true);
});
 
 
</script>