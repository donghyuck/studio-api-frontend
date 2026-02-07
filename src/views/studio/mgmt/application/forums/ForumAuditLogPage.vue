<template>
    <v-breadcrumbs class="pa-0" :items="['시스템관리', '감사', '게시판 감사']" density="compact"></v-breadcrumbs>
    <PageToolbar title="" label="게시판 감사 이력" @refresh="refresh" :closeable="false" :divider="true" :prepend-items="[]"
        :items="[{ icon: 'mdi-refresh', event: 'refresh' }]" />
    <v-card density="compact" variant="text" class="mt-1">
        <v-card-text class="pa-0">
            <v-row no-gutters class="pb-0 px-0 mb-0 pt-3">
                <v-col>
                    <v-menu v-model="dateMenuStart" :close-on-content-click="false" transition="scale-transition" offset-y>
                        <template #activator="{ props }">
                            <v-text-field v-bind="props" label="시작일(포함)" prepend-inner-icon="mdi-calendar"
                                variant="outlined" density="compact" readonly class="mr-2"
                                :model-value="dateStartDisplay" placeholder="예: 2025년 10월 29일 (수)"
                                :error="!validRange" />
                        </template>
                        <v-date-picker v-model="dateStart" @update:modelValue="dateMenuStart = false" show-adjacent-months
                            :first-day-of-week="0" />
                    </v-menu>
                </v-col>
                <v-col>
                    <v-menu v-model="dateMenuEnd" :close-on-content-click="false" transition="scale-transition" offset-y>
                        <template #activator="{ props }">
                            <v-text-field v-bind="props" label="종료일(포함)" prepend-inner-icon="mdi-calendar"
                                variant="outlined" density="compact" readonly class="mr-2" :model-value="dateEndDisplay"
                                placeholder="예: 2025년 10월 29일 (수)" :error="!validRange"
                                :messages="!validRange ? ['시작일이 종료일보다 늦을 수 없습니다.'] : []" />
                        </template>
                        <v-date-picker v-model="dateEnd" @update:modelValue="dateMenuEnd = false" show-adjacent-months
                            :first-day-of-week="0" />
                    </v-menu>
                </v-col>
                <v-col>
                    <v-text-field clearable variant="outlined" label="Actor ID" density="compact" v-model="actorId"
                        @keydown.enter="onSearchClick"></v-text-field>
                </v-col>
            </v-row>
        </v-card-text>
        <v-card-actions class="pa-0 mt-0">
            <v-btn-toggle color="deep-purple-accent-3" rounded="5" group density="compact">
                <v-btn @click="setToday"><span class="hidden-sm-and-down">오늘</span></v-btn>
                <v-btn @click="set7days">7일</v-btn>
                <v-btn @click="set30days">30일</v-btn>
                <v-btn @click="set6Months">6개월</v-btn>
                <v-btn @click="setThisMonth">이번달</v-btn>
            </v-btn-toggle>
            <v-spacer></v-spacer>
            <v-btn icon="mdi-text-search" variant="tonal" :disabled="!validRange" @click="onSearchClick"></v-btn>
        </v-card-actions>
    </v-card>
    <v-row>
        <v-col cols="12" md="12">
            <PageableGridContent @filter-actived="onPageableGridFilterActived" ref="pageableGridContentRef"
                :datasource="dataStore" :columns="columnDefs">
            </PageableGridContent>
        </v-col>
    </v-row>
</template>

<script setup lang="ts">
import GridContent from '@/components/ag-grid/GridContent.vue';
import PageableGridContent from '@/components/ag-grid/PageableGridContent.vue';
import PageToolbar from '@/components/bars/PageToolbar.vue';
import { usePageableForumAuditLogStore } from '@/stores/studio/mgmt/audit.forum-log.store';
import type { ColDef } from 'ag-grid-community';
import { computed, onMounted, ref } from 'vue';
import ServerSideUserCellRenderer from "@/components/ag-grid/renderer/ServerSideUserCellRenderer.vue";

const dataStore = usePageableForumAuditLogStore();

const columnDefs: ColDef[] = [
    { field: 'auditId', headerName: 'ID', filter: false, sortable: true, type: 'number', flex: 0.25 },
    { field: 'at', headerName: '일시', filter: false, sortable: true, type: 'datetime', flex: 0.6 },
    {
        headerName: '액션',
        filter: false,
        sortable: true,
        type: 'string',
        flex: 0.35,
        valueGetter: (params) => params.data?.action ?? '',
    },
    {
        headerName: '엔티티(유형)',
        filter: false,
        sortable: false,
        type: 'string',
        flex: 0.4,
        valueGetter: (params) => params.data?.entityType ?? '',
    },
    {
        headerName: '엔티티 ID',
        filter: false,
        sortable: false,
        type: 'string',
        flex: 0.35,
        valueGetter: (params) => params.data?.entityId ?? '',
    },
    {
        headerName: '포럼 ID',
        filter: false,
        sortable: false,
        type: 'number',
        flex: 0.35,
        valueGetter: (params) => params.data?.forumId ?? '',
    },
    {
        headerName: '생성자(Actor ID)',
        filter: false,
        sortable: false,
        type: 'number',
        flex: 0.35,
        field: "actorId",
        cellRenderer: ServerSideUserCellRenderer,
       // valueGetter: (params) => params.data?.actorId ?? '',
    },
    {
        headerName: 'Detail',
        filter: false,
        sortable: false,
        type: 'string',
        flex: 1,
        valueGetter: (params) => {
            const detail = params.data?.detail;
            if (!detail) return '';
            try {
                return JSON.stringify(detail);
            } catch {
                return String(detail);
            }
        },
    },
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

const fmtKo = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
    weekday: 'short', timeZone: 'Asia/Seoul',
});
const dateStartDisplay = computed(() => dateStart.value ? fmtKo.format(new Date(dateStart.value)) : '');
const dateEndDisplay = computed(() => dateEnd.value ? fmtKo.format(new Date(dateEnd.value)) : '');

const dateStart = ref<string | null>(null); // 'YYYY-MM-DD'
const dateEnd = ref<string | null>(null); // 'YYYY-MM-DD'
const dateMenuStart = ref(false);
const dateMenuEnd = ref(false);

function startOfDayLocalToIso(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d, 0, 0, 0, 0); // local
    return dt.toISOString();
}

function endOfDayExclusiveLocalToIso(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d + 1, 0, 0, 0, 0); // next day 00:00
    return dt.toISOString();
}

const validRange = computed(() => {
    if (!dateStart.value || !dateEnd.value) return true;
    return dateStart.value <= dateEnd.value;
});

const queryFrom = computed(() => {
    if (!dateStart.value) return null;
    return startOfDayLocalToIso(dateStart.value);
});
const queryTo = computed(() => {
    if (!dateEnd.value) return null;
    return endOfDayExclusiveLocalToIso(dateEnd.value);
});

function setPreset(days: number) {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    dateStart.value = start.toISOString().slice(0, 10);
    dateEnd.value = end.toISOString().slice(0, 10);
}

function setToday() { setPreset(1); }
function set7days() { setPreset(7); }
function set30days() { setPreset(30); }
function setThisMonth() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    dateStart.value = start.toISOString().slice(0, 10);
    dateEnd.value = end.toISOString().slice(0, 10);
}

function set6Months() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    dateStart.value = start.toISOString().slice(0, 10);
    dateEnd.value = end.toISOString().slice(0, 10);
}

const actorId = ref<string>();

function onSearchClick() {
    if (!validRange.value) return;
    fetchPage();
}

async function fetchPage() {
    const params: Record<string, any> = {};
    if (queryFrom.value) params.from = queryFrom.value;
    if (queryTo.value) params.to = queryTo.value;
    if (actorId.value) params.actorId = actorId.value;
    dataStore.setFilter(params);
    refresh();
}

onMounted(() => {
    setPreset(7);
});
</script>
