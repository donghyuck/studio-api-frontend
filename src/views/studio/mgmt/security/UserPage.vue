<template>
    <v-breadcrumbs class="pa-0" :items="['시스템관리', '보안관리', '회원']" density="compact"></v-breadcrumbs>
    <PageToolbar title="회원 목록" :label="values.name" :previous="true" :closeable="false" :divider="true" :items="[
        { icon: 'mdi-refresh', event: 'refresh', }]"></PageToolbar>
    <v-row>
        <v-col cols="12" md="12">
            <v-card class="mt-2">
                <v-card-text>
                    <form @submit.prevent="">
                        <v-row no-gutters>
                            <v-col cols="12" md="4" class="pr-5">
                                <v-skeleton-loader type="image" :loading="loading">
                                    <v-responsive>
                                        <AvatarUploader :user-id="userId" @uploaded="() => {}" @error="e => console.error(e)" :protected-initial="true" />
                                    </v-responsive>
                                </v-skeleton-loader>
                            </v-col>
                            <v-col cols="12" md="8">
                                <v-row>
                                    <v-col cols="12" md="4">
                                        <v-text-field label="사용자 ID" :model-value="values.userId" disabled
                                            hint="서버 발급 식별자" persistent-hint />
                                    </v-col>
                                    <v-col cols="12" md="8">
                                        <v-skeleton-loader v-if="overlay" type="text"></v-skeleton-loader>
                                        <v-text-field v-else v-model="username" :error-messages="errors.username"
                                            label="아이디" @blur="validateField('username')" required /></v-col>
                                    <v-col cols="12" md="6">
                                        <v-text-field v-model="name" :error-messages="errors.name" label="이름"
                                            @blur="validateField('name')" required :loading="overlay" /></v-col>
                                    <v-col cols="12" md="6">
                                        <v-text-field v-model="email" :error-messages="errors.email" label="이메일"
                                            @blur="validateField('email')" required :loading="overlay" /></v-col>
                                    <v-col cols="12" md="4">
                                        <v-switch v-model="emailVisible" inset label="이메일 공개" :disabled="overlay"
                                            color="info" /> </v-col>
                                    <v-col cols="12" md="4">
                                        <v-switch v-model="nameVisible" inset label="이름 공개" :disabled="overlay"
                                            color="info" /></v-col>
                                    <v-col cols="12" md="4">
                                        <v-switch v-model="enabled" inset :label="enabled ? '사용자 활성' : '사용자 비활성'"
                                            :disabled="overlay" color="info" /></v-col>
                                </v-row>
                            </v-col>
                        </v-row>
                        <PropertiesGrid :rowData="properties" @change="handleChange" height="200px" />
                    </form>
                </v-card-text>
                <v-divider class="border-opacity-100" color="primary" />
                <v-card-actions>
                    <v-btn prepend-icon="mdi-shield-account-variant" variant="tonal" color="primary" rounded="xl"
                        width="100">
                        Roles
                        <UserRolesDialog activator="parent" v-model="userRolesDialog.visible" :userId="userId"
                            @close="userRolesDialog.visible = false" @updated="refresh"></UserRolesDialog>
                    </v-btn>
                     <v-btn prepend-icon="mdi-shield-account-variant" variant="tonal" color="red" rounded="xl"
                        width="150">
                        Password Reset
                        <PasswordResetDialog activator="parent" v-model="dialog_password.visible" :userId="userId"
                            @close="dialog_password.visible = false"></PasswordResetDialog>
                    </v-btn>
                    <v-spacer />
                    <v-btn variant="tonal" color="grey" rounded="xl" width="100"
                        @click="hasHistory() ? $router.go(-1) : $router.push('/')">
                        Cancel
                    </v-btn>
                    <v-btn variant="outlined" prepend-icon="mdi-content-save" rounded="xl" color="primary"
                        @click="onSubmit" :loading="saving" width="100">
                        Save
                    </v-btn>
                </v-card-actions>
            </v-card>
            <v-overlay v-model="overlay" contained class="align-center justify-center">
                <v-progress-circular color="primary" indeterminate size="64" />
            </v-overlay>
        </v-col>
    </v-row>
</template>
<script setup lang="ts">
import PageToolbar from '@/components/bars/PageToolbar.vue';
import { usePageableUsersStore } from '@/stores/studio/mgmt/users.store';
import type { Property } from '@/types/studio';
import PropertiesGrid from '../PropertiesGrid.vue';
import { fromRowData, hasHistory, toRowData } from '@/utils/helpers';
import { onMounted, ref, computed } from 'vue';
import { useForm } from 'vee-validate'
import * as yup from 'yup'
import { toTypedSchema } from '@vee-validate/yup'
import { object } from 'yup';
import { useConfirm } from '@/plugins/confirm';
import { useToast } from '@/plugins/toast';
import UserRolesDialog from './UserRolesDialog.vue';
import PasswordResetDialog from './PasswordResetDialog.vue';
import { useAuthStore } from '@/stores/studio/mgmt/auth.store';
import { storeToRefs } from 'pinia'; 
import AvatarUploader from '@/components/users/AvatarUploader.vue';

const auth = useAuthStore();

const { token } = storeToRefs(auth);

const props = defineProps({
    userId: { type: Number, default: 0 },
});

const store = usePageableUsersStore();
const toast = useToast();
const confirm = useConfirm();
const overlay = ref(false);
const saving = ref(false);

const userRolesDialog = ref({
    visible: false,
    userId: 0,
});

const dialog_password = ref({
    visible: false,
    userId: 0,
});

const schema = toTypedSchema(object({
    userId: yup.number().integer().positive().optional(),
    username: yup
        .string()
        .required('아이디를 입력하세요.')
        .min(3, '3자 이상')
        .max(32, '32자 이하')
        .matches(/^[a-z0-9._-]+$/i, '영문/숫자/._-만 허용'),
    name: yup.string().required('이름을 입력하세요.').max(64, '64자 이하'),
    email: yup.string().required('이메일을 입력하세요.').email('이메일 형식이 아닙니다.'),
    emailVisible: yup.boolean().default(false),
    nameVisible: yup.boolean().default(false),
    enabled: yup.boolean().default(true),
    properties: yup.object().default({}),
}))

const blank = {
    userId: undefined,
    username: '',
    name: '',
    email: '',
    emailVisible: false,
    nameVisible: false,
    enabled: true,
    properties: {} as Record<string, any>,
}

const {
    values,
    errors,
    handleSubmit,
    validateField,
    resetForm,
    setFieldValue,
    useFieldModel,
} = useForm({
    validationSchema: schema,
    initialValues: blank,
    validateOnMount: false,
})

const [
    username, name, email,
    emailVisible, nameVisible, enabled,
] = useFieldModel([
    'username', 'name', 'email',
    'emailVisible', 'nameVisible', 'enabled',
])

function mapServerToForm(u: any) {
    // 서버 응답을 폼 스키마에 맞춰 보정(널 대비/타입 캐스팅)
    return {
        userId: u.userId,
        username: u.username ?? '',
        name: u.name ?? '',
        email: u.email ?? '',
        emailVisible: !!u.emailVisible,
        nameVisible: !!u.nameVisible,
        enabled: !!u.enabled,
        properties: {},
    }
}
const loading = ref(true);
const properties = ref<Property[]>([]);

async function getData(force: boolean = false) {
    overlay.value = true;
    try {
        const data = await store.byId(props.userId, { revalidate: false })
        if (data) {
            const formVals = mapServerToForm(data)
            resetForm({ values: formVals })
            if (data.properties) {
                properties.value = toRowData(data.properties)
            } else {
                properties.value = []
            }
            loading.value = false;
        }
    } finally {
        overlay.value = false;
    }
}

const onSubmit = handleSubmit(async (form) => {
    if (!Number.isFinite(props.userId)) return
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
        form.properties = fromRowData(properties.value);
        await store.update(props.userId, form as any, { refreshList: false }) // 필요시 true로 목록 재조회 
        toast.success('저장 완료!');
    } finally {
        saving.value = false
    }
})

function handleChange(all: Property[]) {
    console.log('changed rows:', all)
    properties.value = all;
}

const refresh = () => {
    getData()
}

const encodedUrl = computed(() => {
    return `${import.meta.env.VITE_API_BASE_URL}/api/mgmt/users/${props.userId}/avatars/primary`;
});

onMounted(() => {
    if (props.userId > 0) {
        getData();
    }
});
</script>
