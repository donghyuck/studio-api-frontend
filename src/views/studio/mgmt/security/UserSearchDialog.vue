<template>
    <v-dialog max-width="700">
        <v-card :title="title" :subtitle="subtitle">
            <v-card-text>
                <v-row dense>
                    <v-col cols="12" sm="12">
                        <v-text-field :loading="overlay" append-inner-icon="mdi-account-search" density="compact"
                            label="Enter a name, username or email" hide-details single-line v-model="q" clearable
                            @keydown.enter="handleSearch" @click:clear="handleSearch"
                            @click:append-inner="handleSearch"></v-text-field>
                    </v-col>
                    <v-col cols="12" sm="12">
                        <PageableGridContent @filter-actived="onPageableGridFilterActived" :colIdToSnakeCase="false"
                            :options='{ rowSelection: rowSelection }' :height="450" ref="pageableGridContentRef"
                            :datasource="dataStore" :columns="columnDefs" class="border-0">
                        </PageableGridContent>
                    </v-col>
                </v-row>
            </v-card-text>
            <v-card-actions>
                <v-btn variant="plain"  prepend-icon="mdi-account-multiple-check" rounded="xl" spaced="end" class="pr-5" 
                    :color="checked ? 'red' : 'primary'"
                    v-if="selectable" :disabled="!canSelectAllDisplayed" @click="toggleSelectAll" >
                    <template v-slot:append>({{ selectedRows.length }})</template> 
                    전체 선택/해제
                </v-btn> 
                <v-btn variant="tonal" color="blue" :prepend-icon="selectBtnIcon" rounded="xl"
                    v-if="selectable" :disabled="!selected" @click="select" spaced="end" class="pr-5" >
                    {{selectBtnText}}
                </v-btn> 
                <v-spacer></v-spacer>
                <v-btn variant="tonal" color="grey" rounded="xl" @click="handleClose" width="100">
                    Cancel
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
<script setup lang="ts">
import PageableGridContent from '@/components/ag-grid/PageableGridContent.vue';
import { useConfirm } from '@/plugins/confirm';
import { useFindUserDataSource } from '@/stores/studio/mgmt/find.user.store';
import type { UserDto } from '@/types/studio/user';
import type { ColDef, RowSelectionOptions } from 'ag-grid-community';
import { computed, ref } from 'vue';

const overlay = ref(false);
const emit = defineEmits<{
    (e: 'close'): void
    (e: 'selected', payload: UserDto[]): void
}>();
const confirm = useConfirm();
const dataStore = useFindUserDataSource();

const props = withDefaults(defineProps<{
    title?: string,
    subtitle?: string,
    selectable?: boolean;
    selectBtnText?: string;
    selectBtnIcon?: string;
    confirmMessage?: string;
    autoDeselectAll?: boolean;
    autoCloseOnSuccess?: boolean;
    onSelected?: (users: UserDto[]) => void | Promise<void>;
}>(), {
    title: 'Search',
    subtitle: '사용자를 이름, 아이디, 메일 주소로 검색 후 선택하세요.',
    selectable: true,
    confirmMessage: "선택된 사용자을 추가하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
    autoDeselectAll: true,
    autoCloseOnSuccess: true,
    selectBtnIcon: 'mdi-account-multiple-plus',
    selectBtnText: '선택',
})

const q = ref('');
const handleSearch = async () => {
    dataStore.setFilter({ q: q.value?.trim() });
    refresh();
};

const rowSelection: RowSelectionOptions = {
    mode: 'multiRow',
};

const columnDefs: ColDef[] = [
    {
        field: 'username', headerName: '아이디',
        suppressHeaderMenuButton: true,
        filter: false, sortable: true, type: "string", flex: .8
    },
    { field: 'name', headerName: '이름', filter: false, sortable: true, type: "string", flex: .8 },
    { field: 'email', headerName: '메일', filter: false, sortable: true, type: 'string', flex: 1, },
    { field: 'status', headerName: '상태', filter: false, sortable: true, type: 'string', flex: .5, },
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
const selected = computed(() => selectedRows.value.length > 0);
const rowCount = computed(() => dataStore.dataItems.length ?? 0);
const canSelectAllDisplayed = computed(() => rowCount.value > 1);

const checked = ref(false);
const toggleSelectAllBtnText = computed(() => {
    if( checked.value )
        return '해제';
    else 
        return ''
});
const toggleSelectAll = () => { 
    const on = !checked.value;
    if( on ){
        pageableGridContentRef.value?.selectAll();
    }else {
        pageableGridContentRef.value?.deselectAll();
    }
    checked.value = on;
};

const select = async (members: UserDto[] = []) => {
    const ok = await confirm({
        title: '확인',
        message: props.confirmMessage,
        okText: '확인',
        cancelText: '취소',
        color: 'primary',
    });
    if (!ok) return;

    overlay.value = true;
    try {
        const users = selectedRows.value
        if (props.onSelected) {
            await props.onSelected(users)
        }
        emit('selected', users)
        pageableGridContentRef.value?.deselectAll()
        if (props.autoCloseOnSuccess) {
            handleClose();
        }
    } catch (e) {
        console.error(e)
    } finally {
        overlay.value = false
    }
}
const handleClose = () => {
    q.value = '';
    emit('close')
}
</script>
