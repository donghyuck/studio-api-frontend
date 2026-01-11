<template>
    <v-dialog :key="userId" width="650" :fullscreen="false" :scrim="true" transition="dialog-bottom-transition">
        <v-card>
            <PageToolbar title="Password Reset" @close="handleClose" :closeable="true" :divider="true"
                :items="[{ icon: 'mdi-refresh', event: 'refresh' }]" />
            <v-card-text>
                <v-row dense>
                    <v-col cols="12" sm="12">
                        <v-text-field label="새로운 비밀번호*" v-model="newPassword" :error="!!newPasswordError"
                            :type="showPassword ? 'text' : 'password'"
                             :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                             @click:append-inner="showPassword = !showPassword"
                            :error-messages="newPasswordError" @blur="validateField('newPassword')" type="password" />
                    </v-col>
                    <v-col cols="12" sm="12">
                        <v-textarea v-model="reason" :error="!!reasonError" :error-messages="reasonError"
                            @blur="validateField('reason')" class="mx-2" label="변경 사유*" rows="3"
                            hint="왜 비밀번호를 초기화하는지 간단히 남겨주세요. (예: 계정보안 강화, 사용자 요청 등)" />
                    </v-col>
                </v-row>
            </v-card-text>
            <v-divider class="border-opacity-100" color="primary" />
            <v-card-actions>
                <v-spacer />
                <v-btn variant="tonal" color="grey" rounded="xl" @click="handleClose" width="100">
                    Cancel
                </v-btn>
                <v-btn variant="outlined" prepend-icon="mdi-content-save" rounded="xl" color="primary" width="100"
                    @click="onSubmit">
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
import { ref } from 'vue'
import * as yup from 'yup'
import { useForm, useField } from 'vee-validate'

import PageToolbar from '@/components/bars/PageToolbar.vue'
import { useConfirm } from '@/plugins/confirm'
import { useToast } from '@/plugins/toast'
import { usePageableUsersStore } from '@/stores/studio/users.store'
import { resolveAxiosError } from '@/utils/helpers'
import type { ResetPasswordRequest } from '@/types/studio/user'

const toast = useToast()
const confirm = useConfirm()
const store = usePageableUsersStore()

const props = withDefaults(
    defineProps<{
        userId: number
    }>(),
    {
        userId: 0,
    },
)

const emit = defineEmits<{
    (e: 'close'): void
    (e: 'updated', payload: any): void
}>()

const overlay = ref(false)
const showPassword = ref(false);

/** 유효성 스키마 */
const schema = yup.object({ 
    newPassword: yup
        .string()
        .strict(true)
        .trim()
        .required('새로운 비밀번호는 필수입니다.')
        .min(8, '최소 8자 이상 입력하세요.')
        .max(20, '최대 20자까지 입력 가능합니다.'),
    reason: yup
        .string()
        .strict(true)
        .trim()
        .required('변경 사유는 필수입니다.'),
})

/** 폼 설정 */
const { handleSubmit, validateField, resetForm } = useForm({
    validationSchema: schema,
    initialValues: { newPassword: 'P@sswOrd!', reason: '분실에 의한 관리자 리셋' },
    validateOnMount: false,
    validateOnBlur: true,
    validateOnChange: false,
    validateOnInput: false,
})

/** 필드 단위 상태 */
const { value: newPassword, errorMessage: newPasswordError } =
    useField<string>('newPassword')
const { value: reason, errorMessage: reasonError } =
    useField<string>('reason')

function handleClose() {
    resetForm()
    emit('close')
}

const onSubmit = handleSubmit(async (form) => {
    const ok = await confirm({
        title: '확인',
        message: `"${form.reason}" 이유로 비밀번호를 초기화 하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
        okText: '네',
        cancelText: '아니오',
        color: 'primary',
    })
    if (!ok) return

    overlay.value = true
    try {
        const payload: ResetPasswordRequest = {
            currentPassword: form.newPassword,
            newPassword: form.newPassword,
            reason: form.reason,
        }
        const result = await store.resetPassword(props.userId, payload)
        toast.success('비밀번호 재설정 완료!');
        emit('updated', result)
        handleClose()
    } catch (e) {
        toast.error(resolveAxiosError(e))
    } finally {
        overlay.value = false
    }
})
</script>
