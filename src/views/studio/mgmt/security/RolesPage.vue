<template>
    <v-breadcrumbs class="pa-0" :items="['시스템관리', '보안관리', '롤']" density="compact"></v-breadcrumbs>
    <PageToolbar title="롤 목록" @refresh="refresh" @create="onCreate" :closeable="false" :divider="true" :items="[
        { icon: 'mdi-plus', event: 'create', color: 'blue' , tooltip:'권한 생성'},
        { icon: 'mdi-refresh', event: 'refresh', }]"></PageToolbar>
    <v-card density="compact" class="mt-1" variant="text">
        <v-card-actions class="pa-0">
            <v-text-field v-model="q" density="compact" variant="outlined" label="검색어"
                placeholder="롤 이름을 입력하세요." @keydown.enter="onSearchClick" hide-details>
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
    <RoleDialog v-model="createDialog.visible" :groupId="createDialog.roleId" @close="createDialog.visible = false"  @updated="refresh"></RoleDialog>
   <RoleGrantedUserDialog v-model="roleGrantedDialog.user.visible" :roleId="roleGrantedDialog.roleId" @close="roleGrantedDialog.user.visible = false"  @updated="refresh"></RoleGrantedUserDialog>
   <RoleGrantedGroupDialog v-model="roleGrantedDialog.group.visible" :roleId="roleGrantedDialog.roleId"  @close="roleGrantedDialog.group.visible = false"  @updated="refresh"></RoleGrantedGroupDialog>
</template>
<script setup lang="ts">
import GridContent from '@/components/ag-grid/GridContent.vue';
import PageableGridContent from '@/components/ag-grid/PageableGridContent.vue';
import ActionCellRenderer from '@/components/ag-grid/renderer/ActionCellRenderer.vue';
import { computed, onMounted, ref } from 'vue';
import type { ColDef } from 'ag-grid-community';
import { usePageableRolesStore } from '@/stores/studio/mgmt/roles.store';
import PageToolbar from '@/components/bars/PageToolbar.vue';
import { useRouter } from 'vue-router';
import RoleDialog from './RoleDialog.vue';
import { useConfirm } from '@/plugins/confirm';
import { useToast } from '@/plugins/toast';
import RoleGrantedUserDialog from './RoleGrantedUserDialog.vue'; 
import RoleGrantedGroupDialog from './RoleGrantedGroupDialog.vue';

// grid 
const dataStore = usePageableRolesStore();
const gridData = ref<any[]>();
const loader = ref(false);
const router = useRouter();
const confirm = useConfirm();
const toast = useToast();
const columnActions = [

       {
        label: '사용자',
        color: 'blue',
        variant: 'icon',
        prependIcon: 'mdi-account-multiple',
        event: 'user',
        visible: true,
        tooltip: '롤이 부여된 사용자를 관리합니다.',
        disabled: false,
    },
    {
        label: '그룹',
        color: 'blue',
        variant: 'icon',
        prependIcon: 'mdi-account-group',
        event: 'group',
        visible: true,
        tooltip: '롤이 부여된 그룹을 관리합니다.',
        disabled: false,
    },
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
        label: '상세보기',
        icon: 'mdi-chevron-right',
        event: 'view',
        visible: true,
        disabled: false,
    }

];

async function onAction({ action, row }: { action: string; row: any }) {
    if (action === 'view') {
        router.push({ name: 'RoleDetails', params: { roleId: row.roleId } })
    } else if (action === 'delete') {
        const ok = await confirm({
            title: '확인',
            message: `'${row.name}' 을 삭제할까요?` ,
            okText: '확인',
            cancelText: '취소',
            color: 'primary',
        });
        if (!ok) return;
        await dataStore.delete(row.roleId);
        toast.success( `'${row.name}' 가 삭제되었습니다.` );
        refresh();
    } else if ( action === 'group'){
        roleGrantedDialog.value.roleId = row.roleId;
        roleGrantedDialog.value.group.visible = true;
    } else if ( action === 'user'){
        roleGrantedDialog.value.roleId = row.roleId;
        roleGrantedDialog.value.user.visible = true;
    }
}

// define grid columns
const columnDefs: ColDef[] = [ 
    { field: 'name', headerName: '이름', filter: false, sortable: true, type: "hyperlinks", flex: 1 , cellRendererParams: {
      mode: 'router',
      to: (d: any) => ({ name: 'RoleDetails', params: { roleId: d.roleId } }),
      router: router,
    }},
    { field: 'description', headerName: '설명', filter: false, sortable: false, type: 'string', flex: 2, },
    { field: 'creationDate', headerName: '생성일', filter: false, type: 'date', flex: 1 },
    { field: 'modifiedDate', headerName: '수정일', filter: false, type: 'date', flex: 1 },
    { colId: 'actions', headerName: '', filter: false, sortable: false, flex: 2, cellRenderer: ActionCellRenderer, cellRendererParams: { actions: columnActions, onAction } },
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
const q = ref<string | null>(null);
const onSearchClick = () => {
    const params: Record<string, any> = {};
    if (q.value && q.value.trim().length > 0) {
        params.q = q.value.trim();
        params.fields = "name,description";
    }
    dataStore.setFilter(params);
    refresh();
};


const createDialog = ref({
    visible: false,
    roleId: 0,
});

const roleGrantedDialog = ref({
    roleId : 0,
    group : {visible: false, } ,
    user : { visible: false, } 
});

const onCreate = () => {
    createDialog.value.visible = true;
};


const selectedRows = computed(() => pageableGridContentRef.value?.selectedRows() || []);

onMounted(() => {

});

</script>
