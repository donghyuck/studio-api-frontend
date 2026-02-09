<template>
    <v-dialog v-model="visible" :key="userId" width="650" :fullscreen="false" :scrim="true" transition="dialog-bottom-transition">
        <v-card>
            <PageToolbar title="Roles" @close="handleClose" :closeable="true" :divider="true" @refresh="refresh"
                :items="[{ icon: 'mdi-refresh', event: 'refresh' }]" />
            <v-card-text>
                <v-row dense>
                    <v-col cols="12" sm="12">
                        <v-select v-model="gradtedRoles" :items="roles" label="Granted Roles By Groups" multiple
                            return-object disabled bg-color="blue-lighten-3" hint="그룹에서 부여된 롤은 수정할 수 없습니다."
                            persistent-hint item-title="name" item-value="roleId">
                        </v-select>
                    </v-col>
                    <v-col cols="12" sm="12">
                        <v-select v-model="gradtedUserRoles" :items="roles" label="Granted By User" multiple
                            return-object hint="사용자에게 부여할 롤을 선택하여 주세요." item-title="name" item-value="roleId">
                        </v-select>
                    </v-col>
                </v-row>
            </v-card-text>
            <v-divider />
            <v-card-actions>
                <v-spacer />
                <v-btn variant="tonal" color="grey" rounded="xl" width="100"
                    @click="hasHistory() ? $router.go(-1) : $router.push('/')">
                    Cancel
                </v-btn>
                <v-btn variant="outlined" prepend-icon="mdi-content-save" rounded="xl" color="primary" width="100"
                    @click="saveOrUpdate">
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
import { hasHistory, resolveAxiosError } from '@/utils/helpers';
import { onMounted, ref, watch } from 'vue';

import { useConfirm } from '@/plugins/confirm';
import { useToast } from '@/plugins/toast';
import { usePageableRolesStore, type RoleDto } from '@/stores/studio/mgmt/roles.store';
import { useUserRolesStore } from '@/stores/studio/mgmt/user.roles.store';

const dataStore = usePageableRolesStore();
const urStore = useUserRolesStore();

const props = defineProps({
    userId: { type: Number, default: 0 },
    modelValue: { type: Boolean, default: false },
});

const emit = defineEmits<{
    (e: 'close'): void
    (e: 'updated', payload: any): void
    (e: 'update:modelValue', value: boolean): void
}>()

const toast = useToast();
const confirm = useConfirm();
// define overlays
const overlay = ref(false);
const visible = ref(props.modelValue);

watch(() => props.modelValue, (v) => {
    visible.value = v;
});

watch(visible, (v) => {
    emit('update:modelValue', v);
});

const roles = ref<RoleDto[]>();
const gradtedRoles = ref<RoleDto[]>(); // granted by groups
const gradtedUserRoles = ref<RoleDto[]>(); // granted by user

async function getData(force: boolean = false) {
    if (!visible.value || !props.userId) {
        gradtedRoles.value = [];
        gradtedUserRoles.value = [];
        return;
    }

    overlay.value = true;
    try {
        if (!dataStore.isLoaded || force) {
            await dataStore.fetch();
        }
        roles.value = dataStore.dataItems;

        urStore.setUserId(props.userId);
        gradtedRoles.value = await urStore.getUserGroupsRoles();
        gradtedUserRoles.value = await urStore.getUserRoles();
    } finally {
        overlay.value = false;
    }
}

/** 닫기: 여기서만 초기화 */
const handleClose = () => {
    visible.value = false;
    emit('close')
}

const saveOrUpdate = async () => {
    const ok = await confirm({
        title: '확인',
        message: '사용자 롤을 업데이트하시겠습니까?\n 이 작업은 되돌릴 수 없습니다.',
        okText: '확인',
        cancelText: '취소',
        color: 'primary',
    });
    if (!ok) return;
    overlay.value = true;
    try {
        await urStore.update(gradtedUserRoles.value as RoleDto[]);
        toast.success('롤 저장 완료!');
        emit('close');
    } catch (e: unknown) {  
        toast.error(resolveAxiosError(e));
    } finally {
        overlay.value = false;
    }
}

const refresh = () => {
    getData(true)
}

watch(
    () => [visible.value, props.userId] as const,
    ([isOpen, userId]) => {
        if (!isOpen || !userId) return;
        getData();
    },
    { immediate: true }
);

onMounted(() => {
    if (visible.value && props.userId) {
        getData();
    }
});

</script>
