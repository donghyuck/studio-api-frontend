<template>
    <v-dialog :key="roleId" width="650" :fullscreen="false" :scrim="true" transition="dialog-bottom-transition">
        <v-card>
            <PageToolbar title="Roles" :label="role?.name" @close="handleClose" :closeable="true" :divider="true"
                @refresh="refresh" :items="[{ icon: 'mdi-refresh', event: 'refresh' }]" />
            <v-alert closable rounded="0" icon="mdi-tooltip" :text="`그룹에 ${role.name} 권한 부여는 그룹 관리에서 지원합니다.`" type="info" max-height="100"></v-alert>    
                <v-card-text>
                <v-row dense>
                    <v-col cols="12" sm="12">
                        <v-text-field :loading="overlay" append-inner-icon="mdi-magnify" density="compact" label="그룹 검색"
                            hide-details single-line v-model="q" clearable @keydown.enter="search" @click:clear="search"
                            @click:append-inner="search"></v-text-field>
                    </v-col>
                    <v-col cols="12" sm="12">
                        <PageableGridContent @filter-actived="onPageableGridFilterActived" :colIdToSnakeCase="false"
                            :options='{ rowSelection: rowSelection }' ref="pageableGridContentRef"
                            :datasource="dataStore" :columns="columnDefs">
                        </PageableGridContent>
                    </v-col>
                </v-row>
            </v-card-text>
            <v-divider class="border-opacity-100" color="primary" />
            <v-card-actions>
                <v-btn variant="tonal" color="red" prepend-icon="mdi-account-multiple-remove" rounded="xl"
                    :disabled="!revokeable" @click="revokeRoleFromGroup" width="130">
                    Revoke Role
                </v-btn>
                <v-spacer />
                <v-btn variant="tonal" color="grey" rounded="xl" width="100"
                    @click="hasHistory() ? $router.go(-1) : $router.push('/')">
                    Cancel
                </v-btn>
            </v-card-actions>
        </v-card>
        <v-overlay v-model="overlay" contained class="align-center justify-center">
            <v-progress-circular color="primary" indeterminate size="64" />
        </v-overlay>
    </v-dialog>
</template>
<script setup lang="ts">
import PageableGridContent from '@/components/ag-grid/PageableGridContent.vue';
import PageToolbar from '@/components/bars/PageToolbar.vue';
import { useConfirm } from '@/plugins/confirm';
import { useToast } from '@/plugins/toast';
import type { GroupDto } from '@/stores/studio/mgmt/groups.store';
import { useGroupGrantedStore } from '@/stores/studio/mgmt/role.assignees.store';
import { type AssigneeScope } from '@/stores/studio/mgmt/role.assignees.store.factory';
import { EMPTY_ROLE, usePageableRolesStore, type RoleDto } from '@/stores/studio/mgmt/roles.store';
import { hasHistory } from '@/utils/helpers';
import type { ColDef, RowSelectionOptions } from 'ag-grid-community';
import { computed, onMounted, ref, watch } from 'vue';

const roleDataSource = usePageableRolesStore();
const dataStore = useGroupGrantedStore();

const props = withDefaults(defineProps<{ roleId: number; scope?: AssigneeScope }>(), {
    scope: 'group'
})

const emit = defineEmits<{
    (e: 'close'): void
    (e: 'updated', payload: any): void
}>()

const toast = useToast();
const confirm = useConfirm();
// define overlays
const overlay = ref(false);

watch(() => props.roleId, async (roleId) => {
    dataStore.setContext({ target: props.scope, targetId: props.roleId });
    getData();
}, { immediate: false });

const q = ref('');
const search = async () => {
    dataStore.setFilter({ q: q.value?.trim() });
    refresh();
};

const role = ref<RoleDto>(EMPTY_ROLE);
const assignedGroups = ref<GroupDto[]>(); // granted by groups
const rowSelection: RowSelectionOptions = {
    mode: 'multiRow',
    enableClickSelection: false,
    headerCheckbox: true,
}

const columnDefs: ColDef[] = [
    { field: 'name', headerName: '이름', filter: false, sortable: true, type: "string", flex: .8 },
    { field: 'description', headerName: '설명', filter: false, sortable: false, type: 'string', flex: 1, },
    { field: 'memberCount', headerName: '맴버', filter: false, sortable: false, type: 'number', flex: 1, },
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
const selectedRows = computed(() => pageableGridContentRef.value?.selectedRows() || []);
const revokeable = computed(() => {
    return selectedRows.value.length > 0;
});

function toGroupIds(arr: GroupDto[]): number[] {
  return Array.from(
    new Set(
      arr
        .map(u => u?.groupId)
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    )
  );
}

const revokeRoleFromGroup = async () => {
    const ok = await confirm({
        title: '확인',
        message: `선택된 그룹에서 부여된 "${role.value?.name}" 권한을 회수 하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
        okText: '확인',
        cancelText: '취소',
        color: 'primary',
    });
    if (!ok) return;
    overlay.value = true;
    try { 
        const groupIds = toGroupIds (selectedRows.value); 
        await dataStore.revoke( groupIds );
        toast.success('권한 회수 완료!'); 
        refresh();
    } finally {
        overlay.value = false;
    }
}

async function getData(force: boolean = false) {
    if (props.roleId === 0)
        return;
    overlay.value = true;
    try {
        role.value = (await roleDataSource.byId(props.roleId)) ?? EMPTY_ROLE;
    } finally {
        overlay.value = false;
    }
}

/** 닫기: 여기서만 초기화 */
const handleClose = () => {
    emit('close')
}


onMounted(() => {
    dataStore.init({ target: props.scope, targetId: props.roleId });
    getData();
});

</script>