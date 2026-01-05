<template>
    <v-breadcrumbs class="pa-0" :items="['시스템관리', '감사', '로그인 실패']" density="compact"></v-breadcrumbs>
    <PageToolbar @refresh="refresh" :closeable="false" :divider="true" :prepend-items="[
    ]" :items="[
        { icon: 'mdi-refresh', event: 'refresh', }]"></PageToolbar>
    <v-card density="compact" variant="text" class="mt-1">
        <v-card-text class="pa-0">
            <v-row no-gutters class="pb-0 px-0 pt-2">
                <v-col>
                    <v-menu v-model="dateMenuStart" :close-on-content-click="false" transition="scale-transition"
                        offset-y>
                        <template #activator="{ props }">
                            <v-text-field v-bind="props" label="시작일(포함)" prepend-inner-icon="mdi-calendar"
                                variant="outlined" density="compact" readonly class="mr-2"
                                :model-value="dateStartDisplay" placeholder="예: 2025년 10월 29일 (수)"
                                :error="!validRange" />
                        </template>
                        <v-date-picker v-model="dateStart" @update:modelValue="dateMenuStart = false"
                            show-adjacent-months :first-day-of-week="0" />
                    </v-menu>
                </v-col>
                <v-col>
                    <v-menu v-model="dateMenuEnd" :close-on-content-click="false" transition="scale-transition"
                        offset-y>
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
                    <v-text-field clearable variant="outlined" label="아이디" density="compact"
                        v-model="usernameLike"></v-text-field>
                </v-col>
            </v-row> 
        </v-card-text>
        <v-card-actions class="pa-0">
            <v-btn-toggle color="deep-purple-accent-3" rounded="5" group density="compact">
                <v-btn @click="setToday"><span class="hidden-sm-and-down">오늘</span></v-btn>
                <v-btn @click="set7days">7일</v-btn>
                <v-btn @click="set30days">30일</v-btn>
                <v-btn @click="set6Months">6개월</v-btn>
                <v-btn @click="setThisMonth">이번달</v-btn></v-btn-toggle>
            <v-spacer></v-spacer>
            <!-- <v-btn class="pr-5" width="100" variant="outlined" rounded="xl" prepend-icon="mdi-magnify" text="조회"
                :disabled="!validRange" @click="onSearchClick">
            </v-btn> -->
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
import PageToolbar from '@/components/buttons/PageToolbar.vue';
import { useConfirm } from '@/plugins/confirm';
import { useToast } from '@/plugins/toast';
import { usePageableLoginFailureLogStore } from '@/stores/studio/audit.login-failure-log.store';
import type { ColDef } from 'ag-grid-community';
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

// grid 
const dataStore = usePageableLoginFailureLogStore();
const gridData = ref<any[]>();
const loader = ref(false);
const router = useRouter();
const confirm = useConfirm();
const toast = useToast();
const columnActions = [
    {
        label: '삭제',
        variant: 'outlined',
        prependIcon: 'mdi-delete',
        color: 'red',
        event: 'delete',
        visible: true,
        tooltip: '롤을 삭제합니다.'
    },
    {
        label: '사용자',
        color: 'blue',
        variant: 'outlined',
        prependIcon: 'mdi-account-multiple',
        event: 'user',
        visible: true,
        tooltip: '롤이 부여된 사용자를 관리합니다.',
        disabled: false,
    },
    {
        label: '그룹',
        color: 'blue',
        variant: 'outlined',
        prependIcon: 'mdi-account-group',
        event: 'group',
        visible: true,
        tooltip: '롤이 부여된 그룹을 관리합니다.',
        disabled: false,
    },
    {
        label: '상세보기',
        icon: 'mdi-chevron-right',
        event: 'view',
        visible: true,
        disabled: false,
    }
];

// define grid columns
const columnDefs: ColDef[] = [
    { field: 'id', headerName: 'ID', filter: false, sortable: true, type: "number", flex: .25 },
    { field: 'occurredAt', headerName: '일시', filter: false, sortable: true, type: 'datetime', flex: .6 },
    { field: 'username', headerName: '아이디', filter: false, sortable: true, type: 'string', flex: .25 },
    { field: 'remoteIp', headerName: 'IP', filter: false, sortable: true, type: 'string', flex: .5 },
    { field: 'message', headerName: '메시지', filter: false, sortable: false, type: 'string', flex: 1 },
    { field: 'userAgent', headerName: 'UserAgent', filter: false, sortable: false, type: 'string', },
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

const fmtKo = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
    weekday: 'short', timeZone: 'Asia/Seoul',
});
const dateStartDisplay = computed(() => dateStart.value ? fmtKo.format(new Date(dateStart.value)) : '');
const dateEndDisplay = computed(() => dateEnd.value ? fmtKo.format(new Date(dateEnd.value)) : '');

const dateStart = ref<string | null>(null) // 'YYYY-MM-DD'
const dateEnd = ref<string | null>(null) // 'YYYY-MM-DD'
const dateMenuStart = ref(false)
const dateMenuEnd = ref(false)

// v-data-table-server 모델
const page = ref(1)       // v-data-table는 1-based
const itemsPerPage = ref(15)
const sortBy = ref<{ key: string, order: 'asc' | 'desc' }[]>([
    { key: 'occurredAt', order: 'desc' }
])

// ====== 유틸: 로컬 날짜를 ISO(UTC)로 변환 ======
/**
 * YYYY-MM-DD -> 로컬타임 기준 00:00의 ISO UTC
 */
function startOfDayLocalToIso(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number)
    const dt = new Date(y, m - 1, d, 0, 0, 0, 0) // local
    return dt.toISOString()
}
/**
 * YYYY-MM-DD -> 로컬타임 기준 다음날 00:00의 ISO UTC (end-exclusive)
 */
function endOfDayExclusiveLocalToIso(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number)
    const dt = new Date(y, m - 1, d + 1, 0, 0, 0, 0) // 다음날 00:00
    return dt.toISOString()
}

const validRange = computed(() => {
    if (!dateStart.value || !dateEnd.value) return true
    return dateStart.value <= dateEnd.value
})

const queryFrom = computed(() => {
    if (!dateStart.value) return null
    return startOfDayLocalToIso(dateStart.value)
})
const queryTo = computed(() => {
    if (!dateEnd.value) return null
    return endOfDayExclusiveLocalToIso(dateEnd.value)
})


// 초기: 최근 7일
function setPreset(days: number) {
    const now = new Date()
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate()) // today
    const start = new Date(end)
    start.setDate(start.getDate() - (days - 1))
    dateStart.value = start.toISOString().slice(0, 10)
    dateEnd.value = end.toISOString().slice(0, 10)
}

// ====== 빠른 범위 ======
function setToday() { setPreset(1) }
function set7days() { setPreset(7) }
function set30days() { setPreset(30) }
function setThisMonth() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    dateStart.value = start.toISOString().slice(0, 10)
    dateEnd.value = end.toISOString().slice(0, 10)
}

function set6Months() {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    dateStart.value = start.toISOString().slice(0, 10)
    dateEnd.value = end.toISOString().slice(0, 10)
}


const usernameLike = ref<string>();
// 수동 조회 버튼
function onSearchClick() {
    if (!validRange.value) return
    fetchPage();
}

async function fetchPage() {
    const params: Record<string, any> = {}
    if (queryFrom.value) params.from = queryFrom.value
    if (queryTo.value) params.to = queryTo.value
    if (usernameLike.value) params.usernameLike = usernameLike.value
    dataStore.setFilter(params);
    refresh();
}

onMounted(() => {
    setPreset(7)
});

</script>