<template>
    <v-dialog :key="groupId" width="760" :fullscreen="false" :scrim="true" transition="dialog-bottom-transition">
        <v-card>
            <PageToolbar title="Membership" :label="dataRef.name" @close="emit('close')" @refresh="refresh"
                :closeable="true" @remove-membership="removeMembership" @custom="onClearFilters" :divider="true" :items="[
                    { icon: 'mdi-account-multiple-minus', color: 'red', event: 'remove-membership', disabled: !deleteable },
                    { icon: 'mdi-refresh', event: 'refresh', }]"></PageToolbar>
            <v-card-text>
                <v-row no-gutters><v-col cols="12" sm="12" class="pa-0">
                        <UserSearch @change="addMembership"></UserSearch>
                    </v-col></v-row>
                <v-row><v-col cols="12" sm="12">
                        <PageableGridContent @filter-actived="onPageableGridFilterActived" ref="pageableGridContentRef"
                            :colIdToSnakeCase="false" :options='{ rowSelection: rowSelection }' :datasource="mbStore"
                            :selectedRows="selectedItems" :columns="columnDefs">
                        </PageableGridContent> 
                    </v-col></v-row>
            </v-card-text>
            <v-divider class="border-opacity-100" color="primary" />
            <v-card-actions>
                <v-btn variant="tonal" color="red" prepend-icon="mdi-account-multiple-remove" rounded="xl"
                    :disabled="!deleteable" @click="removeMembership" width="130">
                    Removes
                </v-btn>
                <v-spacer />
                <v-btn variant="tonal" color="grey" rounded="xl" @click="handleClose" width="100">
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
import { ref, onMounted, watch, computed } from 'vue'
import PageToolbar from '@/components/bars/PageToolbar.vue'
import { usePageableGroupsStore, type GroupDto } from '@/stores/studio/groups.store'
import { useToast } from '@/plugins/toast';
import { useConfirm } from '@/plugins/confirm';
import { usePageableGroupMembersStore } from '@/stores/studio/group.members.store';
import type { ColDef, RowSelectionOptions } from 'ag-grid-community';
import PageableGridContent from '@/components/ag-grid/PageableGridContent.vue';
import type { UserDto } from '@/stores/studio/users.store';
import UserSearch from '../UserSearch.vue';

const store = usePageableGroupsStore()
const mbStore = usePageableGroupMembersStore()
const props = defineProps({
    groupId: { type: Number, default: 0 },
});

const dataRef = ref<GroupDto>({ groupId: 0, name: "", description: "", properties: {} });

const toast = useToast();
const confirm = useConfirm();

const emit = defineEmits(['close', 'updated']);
/** 로딩 오버레이 */
const overlay = ref(false)
const columnDefs: ColDef[] = [
    {
        headerCheckboxSelection: true,                         // 각 행 체크박스
        headerCheckboxSelectionFilteredOnly: true,
        field: 'userId', headerName: 'Id', type: 'number', flex: .3, filter: false, sortable: false
    },
    { field: 'name', headerName: 'Name', type: 'string', sortable: false, filter: false, flex: 1 },
    { field: 'username', headerName: 'Username', sortable: false, type: "string", filter: false, flex: 1 },
    { field: 'email', headerName: 'Email', type: 'string', sortable: false, filter: false, flex: 1 },
];

const rowSelection: RowSelectionOptions = {
    mode: 'multiRow',
}
const pageableGridContentRef = ref<InstanceType<typeof PageableGridContent> | null>(null);
const filtersActive = ref(false);

const refresh = () => {
    pageableGridContentRef.value?.refresh();
}
const onClearFilters = () => {
    pageableGridContentRef.value?.clearFilters();
};
function onPageableGridFilterActived(event: any) {
    filtersActive.value = event;
}
const selectedItems = ref<UserDto[]>([]);
const selectedRows = computed(() => pageableGridContentRef.value?.selectedRows() || []);

const deleteable = computed(() => {
    return selectedRows.value.length > 0;
});
watch(() => props.groupId, (val, oldVal) => {
    if (val > 0) {
        if (props.groupId != dataRef.value.groupId)
            getData();
    } else {
        dataRef.value = { groupId: 0, name: "", description: "", properties: {} };
    }
});

const handleClose = () => {
    emit('close')
}


function toUserIds(arr: UserDto[]): number[] {
  return Array.from(
    new Set(
      arr
        .map(u => u?.userId)
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    )
  );
}

const addMembership = async (members: UserDto[] = []) => { 
    const ok = await confirm({
        title: '추가 확인',
        message: '선택된 사용자을 그룹에 추가하시겠습니까? \n 이 작업은 되돌릴 수 없습니다.',
        okText: '확인',
        cancelText: '취소',
        color: 'primary',
    });
    if (!ok) return;
    overlay.value = true;
    try {
        const userIds = toUserIds (members);
        await mbStore.addMembers(userIds);
        toast.success('멤버쉽 추가 완료!');
        emit('updated');
        refresh();
    } finally {
        overlay.value = false;
    }
}


const removeMembership = async () => {
    const ok = await confirm({
        title: '삭제 확인',
        message: '선택된 사용자들을 그룹에서 삭제하시겠습니까? \n 이 작업은 되돌릴 수 없습니다.',
        okText: '확인',
        cancelText: '취소',
        color: 'primary',
    });
    if (!ok) return;
    overlay.value = true;
    try { 
        const userIds = toUserIds (selectedRows.value);
        await mbStore.removeMembers(userIds);
        toast.success('멤버쉽 삭제 완료!');
        emit('updated');
        refresh();
    } finally {
        overlay.value = false;
    }
}


async function getData(force: boolean = false) {
    overlay.value = true;
    try {
        mbStore.setGroupId(props.groupId);
        const data = await store.byId(props.groupId, { revalidate: false })
        dataRef.value = data as GroupDto;
    } finally {
        overlay.value = false;
    }
}

onMounted(() => {
    if (props.groupId > 0) {
        getData();
    }
})

</script>
