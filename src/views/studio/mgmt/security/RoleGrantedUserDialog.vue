<template>
    <v-dialog :key="roleId" width="650" :fullscreen="fullscreen" :scrim="true" transition="dialog-bottom-transition">
        <v-card>
            <PageToolbar title="Roles" :label="role?.name" @close="handleClose" @fullscreen="toggleFullscreen"
                :closeable="true" :divider="true" @refresh="refresh" :items="[
                    { icon: fullscreenIcon, event: 'fullscreen' },
                    { icon: 'mdi-refresh', event: 'refresh' }]" />  
            <v-alert closable rounded="0" icon="mdi-tooltip" :text="`Assign Role 버튼을 클릭하여 ${role.name} 권한을 특정 사용자들에게 부여 할 수 있습니다.`" type="info" max-height="100"></v-alert>    
            <v-card-text>
                <v-row dense>
                    <v-col cols="12" sm="12">
                        <v-text-field :loading="overlay" append-inner-icon="mdi-magnify" density="compact"
                            label="Enter a name, username or email" hide-details single-line v-model="q" clearable
                            @keydown.enter="handleSearch" @click:clear="handleSearch"
                            @click:append-inner="handleSearch"></v-text-field>
                    </v-col>
                    <v-col cols="12" sm="12">
                        <PageableGridContent @filter-actived="onPageableGridFilterActived" :colIdToSnakeCase="false"
                            :options='{ rowSelection: rowSelection }' ref="pageableGridContentRef"
                            :datasource="dataStore" :columns="columnDefs" class="border-0">
                        </PageableGridContent>
                    </v-col>
                </v-row>
            </v-card-text>
            <v-divider class="border-opacity-100" color="primary" />
            <v-card-actions>
                <v-btn variant="tonal" prepend-icon="mdi-account-multiple-plus" color="primary" rounded="xl" spaced="end"
                    class="pr-5">
                    Assign Role
                    <UserSearchDialog activator="parent" v-model="dialog.user.visible"
                        :title="'사용자 권한 부여'"
                        :subtitle="'사용자를 이름, 아이디, 메일 주소로 검색 후 대상을 선택하여 권한을 부여 하세요.'"
                        :confirm-message="`선택된 사용자들에게 ${role.name } 권한을 부여하시겠습니까? 이 작업은 되돌릴 수 없습니다.`"
                        :select-btn-text="'권한부여'"
                        :auto-close-on-success="false"
                        :on-selected="assignRoleToUsers"
                        @close="dialog.user.visible = false"></UserSearchDialog>
                </v-btn>
                <v-btn variant="tonal" color="red" prepend-icon="mdi-account-multiple-remove" rounded="xl"
                    :disabled="!revokeable" @click="revokeRoleFromUser" width="130">
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
import { useUserGrantedStore } from '@/stores/studio/mgmt/role.assignees.store';
import { type AssigneeScope } from '@/stores/studio/mgmt/role.assignees.store.factory';
import { usePageableRolesStore, EMPTY_ROLE, type RoleDto } from '@/stores/studio/mgmt/roles.store';
import type { UserDto } from '@/stores/studio/mgmt/users.store';
import { hasHistory } from '@/utils/helpers';
import type { ColDef, RowSelectionOptions } from 'ag-grid-community';
import { computed, onMounted, ref, watch } from 'vue';
import UserSearchDialog from './UserSearchDialog.vue';

const roleDataSource = usePageableRolesStore();
const dataStore = useUserGrantedStore();

const props = withDefaults(defineProps<{ roleId: number; scope?: AssigneeScope }>(), {
    scope: 'user'
})

const emit = defineEmits<{
    (e: 'close'): void
    (e: 'updated', payload: any): void
}>()

const toast = useToast();
const confirm = useConfirm();
// define overlays
const overlay = ref(false);
const fullscreen = ref(false);

const toggleFullscreen = () => {
    fullscreen.value = !fullscreen.value;
}

const fullscreenIcon = computed(() => {
    if (fullscreen)
        return 'mdi-fullscreen-exit';
    else
        return 'mdi-fullscreen';
});

watch(() => props.roleId, async (roleId) => {
    dataStore.setContext({ target: props.scope, targetId: props.roleId });
    getData();
}, { immediate: false });


const role = ref<RoleDto>(EMPTY_ROLE);
const assignedUsers = ref<UserDto[]>(); // granted by groups
const q = ref('');
const handleSearch = async () => {
    dataStore.setFilter({ q: q.value?.trim() });
    refresh();
};

const rowSelection: RowSelectionOptions = {
    mode: 'multiRow',
    enableClickSelection: false,
    headerCheckbox: true,
}

const columnDefs: ColDef[] = [
    { field: 'username', headerName: '아이디', filter: false, sortable: true, type: "string", flex: .8 },
    { field: 'name', headerName: '이름', filter: false, sortable: true, type: "string", flex: .8 },
    { field: 'email', headerName: '메일', filter: false, sortable: true, type: 'string', flex: 1, },
    { field: 'status', headerName: '상태', filter: false, sortable: true, type: 'text', flex: .5, },
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

const dialog = ref({ user: { visible: false } });
function toUserIds(arr: UserDto[]): number[] {
    return Array.from(
        new Set(
            arr
                .map(u => u?.userId)
                .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
        )
    );
}
const revokeRoleFromUser = async () => {
    const ok = await confirm({
        title: '확인',
        message: `선택된 사용자에게 부여된 "${role.value?.name}" 권한을 회수하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
        okText: '확인',
        cancelText: '취소',
        color: 'primary',
    });
    if (!ok) return;
    overlay.value = true;
    try {
        const userIds = toUserIds(selectedRows.value);
        await dataStore.revoke(userIds);
        pageableGridContentRef.value?.deselectAll();
        toast.success('권한 회수 완료!');
        refresh();
    } finally {
        overlay.value = false;
    }
}
const assignRoleToUsers = async (users: UserDto[]) => {
    const userIds = toUserIds(users);
    await dataStore.assign(userIds);
    toast.success(`총 ${userIds.length}명의 사용자를에게 권한을 부여하였습니다.`)
    refresh();
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