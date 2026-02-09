<template>
    <v-breadcrumbs class="pa-0" :items="['시스템관리', '보안관리', '그룹']" density="compact"></v-breadcrumbs>
    <PageToolbar title="그룹 목록" class="ba-0" @refresh="refresh" @create="onCreate" :closeable="false"
        :divider="true" :items="[
            { icon:'mdi-account-multiple-plus', tooltip:'그룹 생성', text: 'Create Group', variant: 'text', event: 'create', color: 'blue', },
            { icon: 'mdi-refresh', event: 'refresh', }]" ></PageToolbar>
    <v-card density="compact" class="mt-1" variant="text">
        <v-card-actions class="pa-0">
            <v-text-field v-model="q" density="compact" variant="outlined" label="검색어"
                placeholder="그룹 이름을 입력하세요." @keydown.enter="onSearchClick" hide-details>
                <template v-slot:append>
                    <v-btn icon="mdi-text-search" variant="text" @click="onSearchClick"></v-btn>
                </template>
            </v-text-field>
        </v-card-actions>
    </v-card>
    <v-row>
        <v-col cols="12" md="12">
            <PageableGridContent @filter-actived="onPageableGridFilterActived" ref="pageableGridContentRef"
                :datasource="dataStore" :columns="columnDefs">
            </PageableGridContent>
        </v-col>
    </v-row>
    <GroupDialog v-model="groupDialog.visible" :groupId="groupDialog.groupId" @close="groupDialog.visible = false"
        @updated="refresh"></GroupDialog>
    <MembershipDialog v-model="groupMembershipDialog.visible" :groupId="groupMembershipDialog.groupId" @updated="refresh" @close="groupMembershipDialog.visible=false"></MembershipDialog>        
</template>
<script setup lang="ts">
import PageableGridContent from '@/components/ag-grid/PageableGridContent.vue';
import { computed, onMounted, ref } from 'vue';
import type { ColDef } from 'ag-grid-community';
import { usePageableGroupsStore } from '@/stores/studio/mgmt/groups.store';
import PageToolbar from '@/components/bars/PageToolbar.vue';
import ActionCellRenderer from '@/components/ag-grid/renderer/ActionCellRenderer.vue';
import GroupDialog from "./GroupDialog.vue";
import MembershipDialog from './GroupMembershipDialog.vue';
import { useRouter } from 'vue-router';
import { useToast } from '@/plugins/toast';
import { useConfirm } from '@/plugins/confirm';
// grid 
const dataStore = usePageableGroupsStore();
const router = useRouter()
const gridData = ref<any[]>();
const loader = ref(false);
const confirm = useConfirm();
const toast = useToast();
// define grid columns
async function onAction({ action, row }: { action: string; row: any }) {
    if (action === 'view') {
        router.push({ name: 'GroupDetails', params: { groupId: row.groupId } })
    } else if (action === 'membership'){
        groupMembershipDialog.value.groupId = row.groupId;
        groupMembershipDialog.value.visible = true;
    } else if (action === 'delete') {
        const ok = await confirm({
            title: '확인',
            message: `'${row.name}' 그룹을 삭제할까요?`,
            okText: '확인',
            cancelText: '취소',
            color: 'primary',
        });
        if (!ok) return;
        toast.success(`'${row.name}' 가 삭제되었습니다.`);
    }
}
const columnActions = [

    {
        label: '멤버',
        color: 'blue',
        variant: 'icon',
        prependIcon: 'mdi-account-multiple',
        event: 'membership',
        visible: true,
        tooltip: '그룹 구성원을 관리합니다.',
        disabled: false,
    },
    {
        label: '삭제',
        variant: 'outlined',
        prependIcon: 'mdi-delete',
        color: 'red',
        event: 'delete',
        visible: true,
        tooltip: '그룹을 삭제합니다.'
    },
    {
        label: '상세보기',
        icon: 'mdi-chevron-right',
        event: 'view',
        visible: true,
        disabled: false,
    }
];
const columnDefs: ColDef[] = [
    { field: 'name', headerName: '이름', filter: false, sortable: true, type: "hyperlinks", flex: 1 , cellRendererParams: {
      mode: 'router',
      to: (d: any) => ({ name: 'GroupDetails', params: { groupId: d.groupId } }),
      router: router,
    }},
    { field: 'description', headerName: '설명', filter: false, sortable: false, type: 'string', flex: 2, },
    { field: 'memberCount', headerName: '맴버', filter: false, sortable: false, type: "number", flex: .25 },
    { field: 'creationDate', headerName: '생성일', filter: false, type: 'datetime', flex: 1 },
    { field: 'modifiedDate', headerName: '수정일', filter: false, type: 'datetime', flex: 1 },
    { colId: 'actions', headerName: '', filter: false, sortable: false, flex: 1.2, cellRenderer: ActionCellRenderer, cellRendererParams: { actions: columnActions, onAction } },
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
const q = ref<string | null>(null);
const onSearchClick = () => {
    const params: Record<string, any> = {};
    if (q.value && q.value.trim().length > 0) {
        params.q = q.value.trim();
        params.in = "name,description";
    }
    dataStore.setFilter(params);
    refresh();
};

const groupDialog = ref({
    visible: false,
    groupId: 0,
});

const groupMembershipDialog = ref({
    visible: false,
    groupId: 0,
});

const onCreate = () => {
    groupDialog.value.visible = true;
};

const selectedRows = computed(() => pageableGridContentRef.value?.selectedRows() || []);

onMounted(() => {
});

</script>
