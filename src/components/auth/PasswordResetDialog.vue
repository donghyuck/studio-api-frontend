<template>
    <v-dialog width="450" :fullscreen="false" :scrim="true" transition="dialog-bottom-transition">
        <v-card title="비밀번호 재설정">
            <v-alert type="info" variant="tonal" density="comfortable" rounded="0" class="mb-3"
                icon="mdi-information-outline">
                비밀번호 재설정을 위한 확인 메일을 발송합니다.<br>
                입력하신 이메일로 전송된 링크를 통해 비밀번호를 다시 설정할 수 있습니다.
            </v-alert>
            <v-card-text>
                <v-row>
                    <v-col>
                        <v-text-field v-model="email" label="이메일" type="email" required :error="!!emailError" variant="outlined"
                            :error-messages="emailError || ''" @blur="validateEmail" />
                    </v-col>
                </v-row>
            </v-card-text>
            <v-divider class="border-opacity-100" color="primary" />
            <v-card-actions>
                <v-btn variant="tonal" color="grey" rounded="xl" @click="handleClose" width="100">
                    닫기
                </v-btn>
                <v-spacer />
                <v-btn color="primary" rounded="xl" width="140" @click="onSubmit">
                    재설정 메일 보내기
                </v-btn>
            </v-card-actions>
        </v-card>
        <v-overlay v-model="overlay" contained class="align-center justify-center">
            <v-progress-circular color="primary" indeterminate size="64" />
        </v-overlay>
    </v-dialog>
</template>
<script setup lang="ts">
import { requestPasswordReset } from '@/data/studio/auth';
import { useConfirm } from '@/plugins/confirm';
import { useToast } from '@/plugins/toast';
import { resolveAxiosError } from '@/utils/helpers';
import { ref } from 'vue';
import * as yup from 'yup';

const confirm = useConfirm();
const toast = useToast()
const overlay = ref<boolean>(false);
const email = ref<string>("");
const emailError = ref<string | null>(null);
const emailSchema = yup
    .string()
    .required('이메일을 입력해주세요.')
    .email('올바른 이메일 형식이 아닙니다.');

async function validateEmail(): Promise<boolean> {
    try {
        await emailSchema.validate(email.value);
        emailError.value = null;
        return true;
    } catch (err) {
        if (err instanceof yup.ValidationError) {
            emailError.value = err.message;
        } else {
            emailError.value = '이메일을 확인해주세요.';
        }
        return false;
    }
}

const emit = defineEmits<{
    (e: 'close'): void
}>()

/** 닫기: 여기서만 초기화 */
function handleClose() {
    emit('close')
}

async function onSubmit() {
    const ok = await validateEmail();
    if (!ok) return;
    overlay.value = true;
    try {
        await requestPasswordReset(email.value);
        toast.success('비밀번호 재설정 메일이 발송되었습니다.');
        emit('close');
    } catch (e: any) {
        toast.error(resolveAxiosError(e));
    } finally {
        overlay.value = false;
    }
}
</script>