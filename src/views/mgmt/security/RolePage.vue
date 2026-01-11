<template>
    <v-breadcrumbs class="pa-0" :items="['시스템관리', '보안관리', '롤']" density="compact"></v-breadcrumbs>
    <PageToolbar title="롤 목록" :label="name" :previous="true" :closeable="false" :divider="true" @refresh="refresh"
        :items="[
            { icon: 'mdi-refresh', event: 'refresh' }]"></PageToolbar>
    <v-row>
        <v-col cols="12" md="12">
            <v-skeleton-loader :loading="overlay" type="article, actions">
                <v-card class="mt-2">
                    <v-card-text>
                        <form @submit.prevent="">
                            <v-text-field label="Name*" v-model="name" :error-messages="nameError" />
                            <v-textarea label="Description" rows="3" v-model="description"
                                :error-messages="descError" />
                        </form>
                    </v-card-text>
                    <v-card-actions>
                        <v-btn prepend-icon="mdi-shield-account-variant" variant="tonal" color="primary" rounded="xl"  spaced="end" class="pr-5">
                            Role Granted Users
                            <RoleGrantedUserDialog activator="parent"  v-model="roleGrantedDialog.user.visible" :roleId="roleId" @close="roleGrantedDialog.user.visible = false"  @updated="refresh"></RoleGrantedUserDialog>
                        </v-btn>
                        <v-btn prepend-icon="mdi-shield-account-variant" variant="tonal" color="primary" rounded="xl"  spaced="end" class="pr-5">
                            Role Granted Groups
                            <RoleGrantedGroupDialog activator="parent"  v-model="roleGrantedDialog.group.visible" :roleId="roleId" :scope="'group'" @close="roleGrantedDialog.group.visible = false"  @updated="refresh"></RoleGrantedGroupDialog>
                        </v-btn>
                        <v-spacer />
                        <v-btn variant="tonal" color="grey" rounded="xl" width="100"
                            @click="hasHistory() ? $router.go(-1) : $router.push('/')">
                            Cancel
                        </v-btn>
                        <v-btn variant="outlined" prepend-icon="mdi-content-save" rounded="xl" color="primary"
                            :loading="saving" @click="onSubmit" width="100">
                            Save
                        </v-btn>
                    </v-card-actions>
                </v-card>
            </v-skeleton-loader>
            <v-overlay v-model="overlay" contained class="align-center justify-center">
                <v-progress-circular color="primary" indeterminate size="64" />
            </v-overlay>
        </v-col>
    </v-row>

</template>
<script setup lang="ts">
import PageToolbar from '@/components/bars/PageToolbar.vue';
import { hasHistory } from '@/utils/helpers';
import { usePageableRolesStore } from '@/stores/studio/roles.store';
import { onMounted, ref } from 'vue';
// vee-validate
import { useField, useForm } from 'vee-validate'
import * as yup from 'yup'
import { useToast } from '@/plugins/toast';
import { useConfirm } from '@/plugins/confirm'; 
import RoleGrantedGroupDialog from './RoleGrantedGroupDialog.vue';
import RoleGrantedUserDialog from './RoleGrantedUserDialog.vue';

const props = defineProps({
    roleId: { type: Number, default: 0 },
});

const store = usePageableRolesStore();
const toast = useToast();
const confirm = useConfirm();
// define overlays
const overlay = ref(false);
const saving = ref(false);

const roleGrantedDialog = ref({
    group : {visible: false, } ,
    user : { visible: false, } 
});

const schema = yup.object({
    name: yup.string().required('Name은 필수입니다.').min(2, '최소 2자 이상').max(50, '최대 50자'),
    description: yup.string().max(500, '최대 500자').nullable(),
})

const { handleSubmit } = useForm({ validationSchema: schema })
const { value: name, errorMessage: nameError } = useField<string>('name')
const { value: description, errorMessage: descError } = useField<string>('description')

async function getData(force: boolean = false) {
    overlay.value = true;
    try {
        const data = await store.byId( props.roleId, { revalidate:false } )
        if (data) {
            name.value = data.name ?? ''
            description.value = data.description ?? ''
        }
    } finally {
        overlay.value = false;
    }

}
const refresh = () => {
    getData()
}

const onSubmit = handleSubmit(async (form) => {
    if (!Number.isFinite(props.roleId)) return
    const ok = await confirm({
        title: '저장 확인',
        message: '현재 내용을 저장하시겠습니까?',
        okText: '저장',
        cancelText: '취소',
        color: 'primary',
    });
    if (!ok) return;
    saving.value = true
    try {
        await store.update(props.roleId, {
            name: name.value,
            description: description.value,
        }, { refreshList: false }) // 필요시 true로 목록 재조회 
        toast.success('저장 완료!');
    } finally {
        saving.value = false
    }
})

onMounted(() => {
    if (props.roleId > 0) {
        getData();
    }
});


</script>