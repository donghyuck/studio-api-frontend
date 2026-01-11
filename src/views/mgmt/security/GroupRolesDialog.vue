<template>
    <v-dialog :key="groupId" width="650" :fullscreen="false" :scrim="true" transition="dialog-bottom-transition">
        <v-card>
            <PageToolbar title="Roles" @close="handleClose" :closeable="true" :divider="true" @refresh="refresh"
                :items="[{ icon: 'mdi-refresh', event: 'refresh' }]" />
            <v-card-text>
                <v-row dense>
                    <v-col cols="12" sm="12">
                        <v-select v-model="gradtedRoles" :items="roles" label="Granted By Groups" multiple return-object
                            item-title="name" item-value="roleId">
                        </v-select>
                    </v-col>
                </v-row>
            </v-card-text>
            <v-divider class="border-opacity-100" color="primary" />
            <v-card-actions>
                <v-spacer />
                <v-btn variant="tonal" color="grey" rounded="xl" width="100" @click="hasHistory() ? $router.go(-1) : $router.push('/')">
                    Cancel
                </v-btn>
                <v-btn variant="outlined" prepend-icon="mdi-content-save" rounded="xl" color="primary" width="100" @click="saveOrUpdate">
                    Save
                </v-btn>
            </v-card-actions>
        </v-card>
        <v-overlay v-model="overlay" contained class="align-center justify-center">
            <v-progress-circular color="primary" indeterminate size="64" />
        </v-overlay>
    </v-dialog>
</template>
<script setup lang="ts">
import PageToolbar from '@/components/bars/PageToolbar.vue';
import { onMounted, ref } from 'vue';
import { hasHistory } from '@/utils/helpers';

import { useConfirm } from '@/plugins/confirm';
import { useToast } from '@/plugins/toast';
import { usePageableRolesStore, type RoleDto } from '@/stores/studio/roles.store';
import { useGroupRolesStore } from '@/stores/studio/group.roles.store';

const dataStore = usePageableRolesStore();
const grStore = useGroupRolesStore();

const props = defineProps({
    groupId: { type: Number, default: 0 },
});

const emit = defineEmits<{
    (e: 'close'): void
    (e: 'updated', payload: any): void
}>()

const toast = useToast();
const confirm = useConfirm();
// define overlays
const overlay = ref(false);

const roles = ref<RoleDto[]>();
const gradtedRoles = ref<RoleDto[]>(); // granted by groups

async function getData(force: boolean = false) {
    overlay.value = true;
    try {
        if( !dataStore.isLoaded )
            await dataStore.fetch();
        roles.value = dataStore.dataItems;    
        grStore.setGroupId(props.groupId); 
        await grStore.fetch();
        gradtedRoles.value = grStore.dataItems; 
    } finally {
        overlay.value = false;
    }
}

/** 닫기: 여기서만 초기화 */
const handleClose = () => {
    emit('close')
}

const saveOrUpdate = async () => {
    const ok = await confirm({
        title: '확인',
        message: '그룹 롤을 업데이트하시겠습니까?\n 이 작업은 되돌릴 수 없습니다.',
        okText: '확인',
        cancelText: '취소',
        color: 'primary',
    });
    if (!ok) return;
    overlay.value = true;
    try { 
        await grStore.update( gradtedRoles.value as RoleDto[] );
        toast.success('멤버쉽 추가 완료!');
        emit('close'); 
    } finally {
        overlay.value = false;
    }    
}

const refresh = () => {
    getData()
}

onMounted(() => {
    getData();
});

</script>