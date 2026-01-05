<template>
    <v-breadcrumbs class="pa-0" :items="['응용프로그램', '메일', '메일 동기화']" density="compact"></v-breadcrumbs>
    <PageToolbar @refresh="refresh" @email-sync="email_sync" :closeable="false" :divider="true"
        :prepend-items="[
        ]" :items="[
            { icon: 'mdi-email-sync', event: 'email-sync', color: 'blue' },
            { icon: 'mdi-refresh', event: 'refresh', }

        ]"></PageToolbar>
    <v-card density="compact"  variant="text" class="mt-1" v-expand-transition> 
        <v-card-actions class="pa-0"> 
                <v-text-field density="compact" variant="outlined" label="검색어" placeholder="검색어를 입력하세요." row-height="15" rows="2" hide-details>
                    <template v-slot:append>
                        <v-btn icon="mdi-text-search" variant="tonal"></v-btn>
                    </template>
                </v-text-field> 
        </v-card-actions>
    </v-card>
    <PageableGridContent class="mt-1" @filter-actived="onPageableGridFilterActived" ref="pageableGridContentRef"
        :datasource="dataStore" :columns="columnDefs">
    </PageableGridContent>
    <v-overlay v-model="overlay" contained class="align-center justify-center">
        <v-progress-circular color="primary" indeterminate size="64" />
    </v-overlay>
</template>
<script setup lang="ts">
import PageableGridContent from '@/components/ag-grid/PageableGridContent.vue';
import PageToolbar from '@/components/buttons/PageToolbar.vue';
import { mailSync } from '@/data/studio/mail';
import { StompRealtimeClient } from '@/data/studio/realtime';
import { useConfirm } from '@/plugins/confirm';
import { useToast } from '@/plugins/toast';
import { usePageableMailSyncLogStore } from '@/stores/studio/mail.synclog.store';
import { resolveAxiosError } from '@/utils/helpers';
import type { ColDef } from 'ag-grid-community';
import { onMounted, onUnmounted, ref } from 'vue';
import ContentCellRender from '../../services/ai/ContentCellRender.vue';

const realtime = new StompRealtimeClient();

const confirm = useConfirm();
const toast = useToast()
const overlay = ref<boolean>(false);

// grid 
const dataStore = usePageableMailSyncLogStore();
const columnDefs: ColDef[] = [
    { field: 'logId', headerName: 'ID', filter: false, type: 'number', flex: .25, },
    { field: 'processed', headerName: '처리건수', filter: false, type: "number", flex: .25 },
    { field: 'succeeded', headerName: '성공건수', filter: false, type: "number", flex: .25 },
    { field: 'failed', headerName: '실패건수', filter: false, type: "number", flex: .25 },
    { field: 'startedAt', headerName: '시작일', filter: false, type: 'datetime', flex: .5 },
    { field: 'finishedAt', headerName: '종료일', filter: false, type: 'datetime', flex: .5 },
    { field: 'status', headerName: '상태', filter: false, type: 'text', flex: .25 },
    { field: 'message', headerName: '메시지', tooltipField: "message", filter: false, sortable: false, type: 'text', cellRenderer: ContentCellRender, flex: 1 },
    { field: 'triggeredBy', headerName: '방법', filter: false, type: 'text', flex: .5 },
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

const email_sync = async () => {
    const ok = await confirm({
        title: '확인',
        message: `메일 데이터를 가져오겠습니까? 이 작업은 되돌릴 수 없습니다.`,
        okText: '네',
        cancelText: '아니오',
        color: 'primary',
    });
    if (!ok) return;
    try {
        overlay.value = true;
        const data = await mailSync();
        toast.success(`메일 동기화(${data})를 요청했습니다.`);
    } catch (e: any) {
        toast.error(resolveAxiosError(e));
    } finally {
        overlay.value = false;
    }
}

let unsubscribe: (() => void) | null = null;
onMounted(() => {
    realtime.connect();
    realtime.subscribe("/topic/mail-sync", payload => { 
        if( payload?.log) { 
            payload = payload.log;
        } 
        if (payload.status === "completed") {
            toast.success(`동기화 요청{${payload.logId}) 작업이 완료되었습니다. 전체 ${payload.processed} 중 ${payload.succeeded} 성공.`, { timeout: -1 })
            refresh();
        } else if (payload.status === 'failed') {
            toast.error(`동기화 요청{${payload.logId}) 작업이 싪패하였습니다. ${payload.message}`, { timeout: -1 })
        }
    });
    // unsubscribe = subscribeMailSync((payload) => {
    //     if (payload.status === 'completed') {
    //         toast.success(`전체 ${payload.processed} 중 ${payload.succeeded} 이 동기화 되었습니다.`)
    //     } else if (payload.status === 'failed') {
    //         toast.error(`동기화에 싪패하였습니다. ${payload.message}`)
    //     }
    //     refresh();
    // });
});

onUnmounted(() => {
    //if (unsubscribe) unsubscribe();
    console.log("disconnect realtime");
    realtime.disconnect();
});

</script>
