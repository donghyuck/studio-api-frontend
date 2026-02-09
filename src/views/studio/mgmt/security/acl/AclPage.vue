<template>
    <v-breadcrumbs class="pa-0" :items="['시스템관리', '보안관리', '권한관리']" density="compact"></v-breadcrumbs>
    <v-row>
        <v-col cols="12" md="12">
            <PageToolbar title="종류 (도메인 or 클래스)" label="보호할 클래스(FQCN) 또는 도메인 객체 종류" @refresh="refresh_classes"
                @delete="delete_classes" @create="onCreate_classes" :closeable="false" :divider="false" :items="[
                    { icon: 'mdi-minus', event: 'delete', color: 'red', tooltip: '도메인/클래스 삭제', disabled: !deleteable_classes },
                    { icon: 'mdi-plus', event: 'create', color: 'blue', tooltip: '도메인/클래스 생성' },
                    { icon: 'mdi-refresh', event: 'refresh', }]"></PageToolbar>
            <GridContent ref="gridContentRef_classes" :height="300" :rowData="gridData_classes" style=""
                :options='{}' :auto-resize="false" :columns="columnDefs_classes"
                :rowSelection="rowSelection"></GridContent>
        </v-col>
    </v-row>
    <v-row>
        <v-col cols="12" md="12">
            <PageToolbar title="대상(사용자 or 롤)" label="권한을 부여할 대상 (사용자 나 롤)" @refresh="refresh_sids" @delete="delete_sids"
                @create="onCreate_sids" :closeable="false" :divider="false" :items="[
                    { icon: 'mdi-minus', event: 'delete', color: 'red', tooltip: '대상(사용자/롤) 삭제', disabled: !deleteable_sids },
                    { icon: 'mdi-plus', event: 'create', color: 'blue', tooltip: '대상(사용자/롤) 생성' },
                    { icon: 'mdi-refresh', event: 'refresh', }]"></PageToolbar>
            <GridContent ref="gridContentRef_sids" :height="300" :rowData="gridData_sids" style="" :auto-resize="false"
                :options='{}' :columns="columnDefs_sids" :rowSelection="rowSelection">
            </GridContent>
        </v-col>
    </v-row>
    <v-row>
        <v-col cols="12" md="12">
            <PageToolbar title="객체 식별자" @refresh="refresh_objects" @create="onCreate_objects" :closeable="false" @delete="delete_objects"
                :divider="true" :items="[
                     { icon: 'mdi-minus', event: 'delete', color: 'red', tooltip: '객체 식별자 삭제', disabled: !deleteable_objects },
                    { icon: 'mdi-plus', event: 'create', color: 'blue', tooltip: '객체 식별자 생성' },
                    { icon: 'mdi-refresh', event: 'refresh', }]"></PageToolbar>

            <v-banner :stacked="false" icon="mdi-information-slab-box-outline" color="info">
                <template v-slot:text>
                    도메인객체 ID 값 '__root__' 은 도메인 or 클래스 전체를 의미하는 가짜 객체입니다. 이 루트에 ACL 을 부여하여 해당 도메인 or 클래스 에 대한 전체 권한을 부여할
                    수 있습니다.
                </template>
            </v-banner>
            <GridContent ref="gridContentRef_objects" :height="300" :rowData="gridData_objects" style=""
                :options='{}' :auto-resize="false" :columns="columnDefs_objects"
                :rowSelection="rowSelection">
            </GridContent>
        </v-col>
    </v-row>
    <v-row>
        <v-col cols="12" md="12">
            <PageToolbar title="권한 엔트리" @refresh="refresh_entries" @create="onCreate_entries" :closeable="false" @delete="delete_entries"
                :divider="false" :items="[
                    { icon: 'mdi-minus', event: 'delete', color: 'red', tooltip: '접근권한 삭제', disabled: !deleteable_entries },
                    { icon: 'mdi-plus', event: 'create', color: 'blue', tooltip: '접근권한 생성' },
                    { icon: 'mdi-refresh', event: 'refresh', }]"></PageToolbar>
            <v-banner :stacked="false" icon="mdi-information-slab-box-outline" color="info">
                <template v-slot:text>
                    권한 엔트리는 OID(객체 식별자), 순서 값을 키로 합니다. 이런 이유에서 동일 OID, 다른 권한을 추가하는 경우 순서 값을 다르게 적용해야 합니다.
                </template>
            </v-banner>
            <GridContent ref="gridContentRef_entries" :height="300" :rowData="gridData_entries" style=""
                :options='{}' :auto-resize="false" :columns="columnDefs_entries"
                :rowSelection="rowSelection"></GridContent>
        </v-col>
    </v-row>
    <CreateClassDialog v-model="dialog_class.visible" @close="dialog_class.visible = false" @updated="refresh_classes">
    </CreateClassDialog>
    <CreateSidDialog v-model="dialog_sid.visible" @close="dialog_sid.visible = false" @updated="refresh_sids">
    </CreateSidDialog>
    <CreateObjectDialog v-model="dialog_object.visible" @close="dialog_object.visible = false" @updated="refresh_sids">
    </CreateObjectDialog>
    <CreateEntyyDialog v-model="dialog_entry.visible" @close="dialog_entry.visible = false" @updated="refresh_entries">
    </CreateEntyyDialog>
</template>
<script setup lang="ts">
import GridContent from '@/components/ag-grid/GridContent.vue';
import PageToolbar from '@/components/bars/PageToolbar.vue';
import { useToast } from '@/plugins/toast';
import { useAclClassesStore } from '@/stores/studio/mgmt/acl.classes.store';
import { useAclEntriesStore } from '@/stores/studio/mgmt/acl.entries.store';
import { useAclObjectsStore } from '@/stores/studio/mgmt/acl.objects.store';
import { useAclSidsStore } from '@/stores/studio/mgmt/acl.sids.store';
import type { AclClassDto, AclEntryDto, AclObjectIdentityDto, AclSidDto } from '@/types/studio/acl';
import { resolveAxiosError } from '@/utils/helpers';
import type { ColDef, RowSelectionOptions } from 'ag-grid-community';
import { computed, onMounted, ref } from 'vue';
import CreateClassDialog from './CreateClassDialog.vue'
import CreateSidDialog from './CreateSidDialog.vue'
import CreateObjectDialog from './CreateObjectDialog.vue'
import CreateEntyyDialog from './CreateEntryDialog.vue'
import type { AclActionMaskDto } from '@/types/studio/ai';
import { fetchActions } from '@/data/studio/mgmt/acl';
import { useConfirm } from '@/plugins/confirm';
import { number } from 'yup';

const toast = useToast();
const confirm = useConfirm();

const rowSelection = ref<RowSelectionOptions | "single" | "multiple">({
    mode: "multiRow",
    //hideDisabledCheckboxes: true,
    //isRowSelectable: (node) => (node.data ? node.data.year < 2007 : false),
});
const loader = ref(false);


// deletes
type DeleteFn = (id: number) => Promise<unknown>;
type RefreshFn = () => void | Promise<void>;
async function deletes(ids: number[], deleteFn: DeleteFn, refreshFn: RefreshFn) {
    loader.value = true;
    try {
        await Promise.all(ids.map((id: number) => deleteFn(id)));
        toast.success('선택한 데이터가 삭제되었습니다.');
        await refreshFn();
    } catch (e: any) {
        toast.error(resolveAxiosError(e));
    } finally {
        loader.value = false;
    }
}

// clssses
const classesStore = useAclClassesStore();
const gridData_classes = ref<AclClassDto[]>([]);
// define grid columns
const columnDefs_classes: ColDef[] = [
    { field: 'id', headerName: 'ID', filter: false, sortable: true, type: "number", maxWidth: 100 },
    { field: 'className', headerName: '도메인 or 클래스(FQCN)', filter: false, sortable: true, type: "string", flex: 1 },
];
const gridContentRef_classes = ref<InstanceType<typeof GridContent> | null>(null);
const refresh_classes = () => {
    getData_classes(true);
}
const onCreate_classes = () => {
    dialog_class.value.visible = true;
};
const dialog_class = ref({
    visible: false
});


const selectedRows_classes = computed(() => gridContentRef_classes.value?.selectedRows() || []);
const deleteable_classes = computed(() => {
    return selectedRows_classes.value.length > 0;
});
async function delete_classes() {
    if (!deleteable_classes.value) {
        return;
    }
    const ids = selectedRows_classes.value.map((r: any) => (r && typeof r === 'object') ? r.id ?? r : r);
    const ok = await confirm({
        title: '확인',
        message: `선택한 "${ids.length}" 개의 도메인 or 클래스를 삭제 하겠습니까? 이 작업은 되돌릴 수 없습니다.`,
        okText: '네',
        cancelText: '아니오',
        color: 'primary',
    });
    if (!ok) return;
    const deleteFn = classesStore.deleteClass;
    await deletes(ids, deleteFn, refresh_classes );
}

async function getData_classes(force: boolean = false) {
    loader.value = true;
    if (force || gridData_classes.value?.length === 0) {
        gridContentRef_classes.value?.loading(true);
        try {
            await classesStore.fetch();
            gridData_classes.value = [...classesStore.dataItems];
        } catch (e: any) {
            toast.error(resolveAxiosError(e));
        } finally {
            gridContentRef_classes.value?.loading(false);
        }
    }
    loader.value = false;
}


// sids 
const sidsStore = useAclSidsStore();
const gridData_sids = ref<AclSidDto[]>([]);
// define grid columns
const columnDefs_sids: ColDef[] = [
    { field: 'id', headerName: 'SID', filter: false, sortable: true, type: "number", maxWidth: 100 },
    { field: 'principal', headerName: '사용자 여부', filter: false, sortable: true, type: "boolean", maxWidth: 100 },
    { field: 'sid', headerName: '사용자 or 권한', filter: false, sortable: true, type: "text", flex: 1 },
];
const gridContentRef_sids = ref<InstanceType<typeof GridContent> | null>(null);
const refresh_sids = () => {
    getData_sids(true);
}
const onCreate_sids = () => {
    dialog_sid.value.visible = true;
};

const dialog_sid = ref({
    visible: false
});

const selectedRows_sids = computed(() => gridContentRef_sids.value?.selectedRows() || []);
const deleteable_sids = computed(() => {
    return selectedRows_sids.value.length > 0;
});
async function delete_sids() {
    if (!deleteable_classes.value) {
        return;
    }
    const ids = selectedRows_sids.value.map((r: any) => (r && typeof r === 'object') ? r.id ?? r : r);
    const ok = await confirm({
        title: '확인',
        message: `선택한 "${ids.length}" 개의 도메인 or 클래스를 삭제 하겠습니까? 이 작업은 되돌릴 수 없습니다.`,
        okText: '네',
        cancelText: '아니오',
        color: 'primary',
    });
    if (!ok) return;
    const deleteFn = sidsStore.deleteSid;
    await deletes(ids, deleteFn, refresh_sids );
}

async function getData_sids(force: boolean = false) {
    loader.value = true;
    if (force || gridData_sids.value?.length === 0) {
        gridContentRef_sids.value?.loading(true);
        try {
            await sidsStore.fetch();
            gridData_sids.value = [...sidsStore.dataItems];
        } catch (e: any) {
            toast.error(resolveAxiosError(e));
        } finally {
            gridContentRef_sids.value?.loading(false);
        }
    }
    loader.value = false;
}


const objectsStore = useAclObjectsStore();
const gridData_objects = ref<AclObjectIdentityDto[]>([]);
// define grid columns
const columnDefs_objects: ColDef[] = [
    { field: 'id', headerName: 'OID', filter: false, sortable: true, type: "number", maxWidth: 100 },
    { field: 'classId', headerName: '도메인 of 클래스 ID', filter: false, sortable: true, type: "number", maxWidth: 150 },
    { field: 'className', headerName: '도메인 of 클래스 이름', filter: false, sortable: true, type: "text", flex: 1 },
    { field: 'entriesInheriting', headerName: '부모ACL 상속여부', filter: false, sortable: true, type: "boolean", maxWidth: 150 },
    { field: 'objectIdentity', headerName: '도메인 객체 ID', filter: false, sortable: true, type: "number", flex: .5 },
    { field: 'ownerSidId', headerName: '소유자 ID', filter: false, sortable: true, type: "text", flex: .5 },
    { field: 'parentId', headerName: '부모 ID', filter: false, sortable: true, type: "text", flex: .5 },
];
const gridContentRef_objects = ref<InstanceType<typeof GridContent> | null>(null);
const refresh_objects = () => {
    getData_objects(true);
}
const onCreate_objects = () => {
    dialog_object.value.visible = true;
};

const dialog_object = ref({
    visible: false
});

const selectedRows_objects = computed(() => gridContentRef_objects.value?.selectedRows() || []);
const deleteable_objects = computed(() => {
    return selectedRows_objects.value.length > 0;
});
async function delete_objects() {
    if (!deleteable_objects.value) {
        return;
    }
    const ids = selectedRows_objects.value.map((r: any) => (r && typeof r === 'object') ? r.id ?? r : r);
    const ok = await confirm({
        title: '확인',
        message: `선택한 "${ids.length}" 개의 도메인 or 클래스를 삭제 하겠습니까? 이 작업은 되돌릴 수 없습니다.`,
        okText: '네',
        cancelText: '아니오',
        color: 'primary',
    });
    if (!ok) return;
    const deleteFn = objectsStore.deleteObjectIdentity;
    await deletes(ids, deleteFn, refresh_objects );
}


async function getData_objects(force: boolean = false) {
    loader.value = true;
    if (force || gridData_objects.value?.length === 0) {
        gridContentRef_objects.value?.loading(true);
        try {
            await objectsStore.fetch();
            gridData_objects.value = [...objectsStore.dataItems];
        } catch (e: any) {
            toast.error(resolveAxiosError(e));
        } finally {
            gridContentRef_objects.value?.loading(false);
        }
    }
    loader.value = false;
}

function objectByOid(oid: number) {
    return gridData_objects.value?.find(item => item.id === oid)
}


const actions = ref<AclActionMaskDto[]>([]);

function actionByMask(mask: number) {
    return actions.value?.find(item => item.mask === mask)
}

async function loadActions() {
    try {
        const data = await fetchActions();
        actions.value = data;
    } catch (e: any) {
        toast.error(resolveAxiosError(e));
    }
}

const entriesStroe = useAclEntriesStore();
const gridData_entries = ref<AclEntryDto[]>([]);
// define grid columns
const columnDefs_entries: ColDef[] = [
    { field: 'id', headerName: 'ID', filter: false, sortable: true, type: "number", maxWidth: 100 },
    {
        field: 'objectIdentityId', headerName: 'OID', filter: false, sortable: true, type: "number", flex: 1, cellRenderer: (params: any) => {
            const obj = objectByOid(params.value as number);
            return `${params.value} ( ${obj?.className})`;
        }
    },
    { field: 'objectIdentity', headerName: '도메인 객체 ID', filter: false, sortable: true, type: "string", maxWidth: 100 },
    { field: 'sidId', headerName: 'SID', filter: false, sortable: true, type: "string", maxWidth: 100 },
    { field: 'sid', headerName: '사용자 or 롤', filter: false, sortable: true, type: "string", flex: 1 },
    {
        field: 'mask', headerName: '권한', filter: false, sortable: true, type: "string", maxWidth: 120, cellRenderer: (params: any) => {
            const mask = actionByMask(params.value as number);
            return `${params.value} ( ${mask?.action})`;
        }
    },
    { field: 'aceOrder', headerName: '순서', filter: false, sortable: true, type: "number", maxWidth: 80 },
    { field: 'granting', headerName: 'granting', filter: false, sortable: true, type: "boolean", maxWidth: 80 },
    { field: 'auditFailure', headerName: '평가 실패 감사', filter: false, sortable: true, type: "boolean", maxWidth: 100 },
    { field: 'auditSuccess', headerName: '평가 성공 감사', filter: false, sortable: true, type: "boolean", maxWidth: 100 },
];
const gridContentRef_entries = ref<InstanceType<typeof GridContent> | null>(null);
const refresh_entries = () => {
    getData_entries(true);
}
const onCreate_entries = () => {
    dialog_entry.value.visible = true;
};

const dialog_entry = ref({
    visible: false
});

const selectedRows_entries = computed(() => gridContentRef_entries.value?.selectedRows() || []);
const deleteable_entries = computed(() => {
    return selectedRows_entries.value.length > 0;
});
async function delete_entries() {
    if (!deleteable_entries.value) {
        return;
    }
    const ids = selectedRows_entries.value.map((r: any) => (r && typeof r === 'object') ? r.id ?? r : r);
    const ok = await confirm({
        title: '확인',
        message: `선택한 "${ids.length}" 개의 도메인 or 클래스를 삭제 하겠습니까? 이 작업은 되돌릴 수 없습니다.`,
        okText: '네',
        cancelText: '아니오',
        color: 'primary',
    });
    if (!ok) return;
    const deleteFn = entriesStroe.deleteEntry;
    await deletes(ids, deleteFn, refresh_entries );
}

async function getData_entries(force: boolean = false) {
    loader.value = true;
    if (force || gridData_entries.value?.length === 0) {
        gridContentRef_entries.value?.loading(true);
        try {
            await entriesStroe.fetch();
            gridData_entries.value = [...entriesStroe.dataItems];
        } catch (e: any) {
            toast.error(resolveAxiosError(e));
        } finally {
            gridContentRef_entries.value?.loading(false);
        }
    }
    loader.value = false;
}

onMounted(() => {
    getData_classes(true);
    getData_sids(true);
    getData_objects(true);
    getData_entries(true);
    loadActions();
});

</script>
