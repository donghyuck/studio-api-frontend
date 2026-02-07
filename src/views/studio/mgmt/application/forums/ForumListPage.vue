<template>
    <v-breadcrumbs class="pa-0" :items="['응용프로그램', '게시판 관리']" density="compact"></v-breadcrumbs>
    <PageToolbar title="목록" label="게시판을 관리합니다." @create="openCreateDialog"
        @refresh="refresh" :closeable="false" :divider="false" :prepend-items="[
        ]" :items="[
        { icon: 'mdi-plus', event: 'create', tooltip: '게시판 생성하기' },
        { icon: 'mdi-refresh', event: 'refresh', tooltip: '새로고침' }]"></PageToolbar>
    <v-card density="compact" class="mt-1" variant="text">
        <v-card-actions class="pa-0">
            <v-container fluid class="pa-0">
                <v-row>
                    <v-col>
                        <v-text-field v-model="q" label="검색어" placeholder="게시판 이름/슬러그를 입력하세요."
                            @keydown.enter="onSearchClick"
                            hide-details variant="outlined" density="compact">
                            <template v-slot:append>
                                <v-btn icon="mdi-text-search" variant="tonal" @click="onSearchClick" />
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
    <ForumCreateDialog v-model="dialogs.create.visible" @created="onCreated" />
</template>
<script setup lang="ts">
import PageToolbar from '@/components/bars/PageToolbar.vue';
import { useToast } from '@/plugins/toast';
import { usePageableForumListStore } from '@/stores/studio/mgmt/forum.list.store';
import { useNavStore } from '@/stores/studio/mgmt/nav.store';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import PageableGridContent from '@/components/ag-grid/PageableGridContent.vue';
import type { ColDef, GridOptions, SelectionChangedEvent } from 'ag-grid-community';
import ForumCreateDialog from './ForumCreateDialog.vue';

const toast = useToast();
const router = useRouter();
const nav = useNavStore();

// GRID
const dataStore = usePageableForumListStore();
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
    },
    {
        field: 'name',
        headerName: '게시판',
        filter: false,
        sortable: true,
        type: "hyperlinks",
        flex: 1,
        cellRendererParams: {
            mode: 'router',
            to: (d: any) => ({ name: 'ForumDetails', params: { forumSlug: d.slug } }),
            router: router,
        },
    },
    { field: 'slug', headerName: '슬러그', filter: false, sortable: true, type: "string", maxWidth: 100, },
    {
        field: 'viewType',
        headerName: '보기 유형',
        filter: false,
        sortable: true,
        type: "string",
        maxWidth: 100,
        valueFormatter: (params) => viewTypeLabel(params.value),
    },
    {
        field: 'type',
        headerName: '유형',
        filter: false,
        sortable: true,
        type: "string",
        maxWidth: 130,
        valueFormatter: (params) => forumTypeLabel(params.value),
    },
    { field: 'topicCount', headerName: '토픽 수', filter: false, sortable: true, type: 'number', maxWidth: 100 },
    { field: 'postCount', headerName: '댓글 수', filter: false, sortable: true, type: 'number', maxWidth: 100 },
    { field: 'lastActivityAt', headerName: '최근 활동', filter: false, type: 'datetime', flex: 1 },
    { field: 'updatedAt', headerName: '수정일시', filter: false, type: 'datetime', flex: 1 },
];
const gridOptions: GridOptions = {
    rowSelection: 'single',
    rowMultiSelectWithClick: false,
    suppressRowClickSelection: false,
};

const pageableGridContentRef = ref<InstanceType<typeof PageableGridContent> | null>(null);
const filtersActive = ref(false);
const selectedCount = ref(0);
const selectedIds = ref<string[]>([]);
const isDeleteDisabled = computed(() => selectedCount.value === 0);
const gridEvents = [
    {
        type: 'selectionChanged',
        listener: (event: SelectionChangedEvent) => {
            const rows = event.api.getSelectedRows() as Array<{ slug?: string }>;
            selectedCount.value = rows.length;
            selectedIds.value = rows
                .map((row) => row.slug)
                .filter((id): id is string => typeof id === "string" && id.length > 0);
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
// 검색 
const q = ref<string | null>(null)
const inFields = "name,description";
const dialogs = ref({
    create: { visible: false },
});

const viewTypeLabelMap: Record<string, string> = {
    GENERAL: '일반형',
    GALLERY: '갤러리형',
    VIDEO: '동영상형',
    LIBRARY: '자료실형',
    NOTICE: '공지형',
};

const viewTypeLabel = (value?: string) => {
    if (!value) return '';
    return viewTypeLabelMap[value] ?? value;
};

const forumTypeLabelMap: Record<string, string> = {
    COMMON: '일반형',
    NOTICE: '공지형',
    SECRET: '비밀형',
    ADMIN_ONLY: '관리자 전용',
};

const forumTypeLabel = (value?: string) => {
    if (!value) return '';
    return forumTypeLabelMap[value] ?? value;
};

// 수동 조회 버튼
function onSearchClick() {

    const params: Record<string, any> = {}
    if (q.value) {
        params.q = q.value
        params.in = inFields
    }
    
    dataStore.setFilter(params);
    refresh();
}

const openCreateDialog = () => {
    dialogs.value.create.visible = true;
};

const onCreated = ({ slug }: { slug: string }) => {
    dialogs.value.create.visible = false;
    refresh();
    if (slug) {
        router.push({ name: 'ForumDetails', params: { forumSlug: slug } });
    }
};

onMounted(async () => {
    if (nav.previous?.name === 'TemplateDetails' && dataStore.page > 0) {
        pageableGridContentRef.value?.goToPreviousPage();
    }
});
</script>
