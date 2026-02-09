<template>
    <v-dialog v-model="model" width="520" :fullscreen="false" :scrim="true" transition="dialog-bottom-transition">
        <v-card>
            <PageToolbar title="비밀번호 변경" @close="handleClose" :closeable="true" :divider="true" />
            <v-card-text>
                <v-row dense>
                    <v-col cols="12">
                        <v-text-field label="현재 비밀번호*" v-model="currentPassword"
                            :error="!!currentPasswordError" :type="showCurrent ? 'text' : 'password'"
                            :append-inner-icon="showCurrent ? 'mdi-eye-off' : 'mdi-eye'"
                            @click:append-inner="showCurrent = !showCurrent"
                            :error-messages="currentPasswordError" @blur="validateField('currentPassword')" />
                    </v-col>
                    <v-col cols="12">
                        <v-text-field label="새 비밀번호*" v-model="newPassword" :error="!!newPasswordError"
                            :type="showNew ? 'text' : 'password'"
                            :append-inner-icon="showNew ? 'mdi-eye-off' : 'mdi-eye'"
                            @click:append-inner="showNew = !showNew"
                            :error-messages="newPasswordError" @blur="validateField('newPassword')" />
                    </v-col>
                    <v-col cols="12">
                        <v-text-field label="새 비밀번호 확인*" v-model="confirmPassword"
                            :error="!!confirmPasswordError" :type="showConfirm ? 'text' : 'password'"
                            :append-inner-icon="showConfirm ? 'mdi-eye-off' : 'mdi-eye'"
                            @click:append-inner="showConfirm = !showConfirm"
                            :error-messages="confirmPasswordError" @blur="validateField('confirmPassword')" />
                    </v-col>
                    <v-col cols="12">
                        <PasswordPolicyChecklist :policy="effectivePolicy" :password="newPassword || ''" />
                    </v-col>
                </v-row>
            </v-card-text>
            <v-divider />
            <v-card-actions>
                <v-spacer />
                <v-btn variant="tonal" color="grey" rounded="xl" @click="handleClose" width="100">
                    Cancel
                </v-btn>
                <v-btn variant="outlined" prepend-icon="mdi-content-save" rounded="xl" color="primary" width="120"
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
import { computed, onMounted, ref, watch } from 'vue'
import * as yup from 'yup'
import { useForm, useField } from 'vee-validate'
import PageToolbar from '@/components/bars/PageToolbar.vue'
import { useToast } from '@/plugins/toast'
import { resolveAxiosError } from '@/utils/helpers'
import { changeSelfPassword, getSelfPasswordPolicy } from '@/data/studio/auth'
import type { PasswordPolicyDto } from '@/types/studio/user'
import PasswordPolicyChecklist from '@/components/users/PasswordPolicyChecklist.vue'
import { passwordPolicyText } from '@/messages/passwordPolicy'

const model = defineModel<boolean>({ required: true })
const toast = useToast()

const overlay = ref(false)
const showCurrent = ref(false)
const showNew = ref(false)
const showConfirm = ref(false)

const policy = ref<PasswordPolicyDto | null>(null)
const defaultPolicy: PasswordPolicyDto = {
    minLength: 8,
    maxLength: 20,
    requireUpper: false,
    requireLower: false,
    requireDigit: false,
    requireSpecial: false,
    allowedSpecials: '!@#$%^&*',
    allowWhitespace: false,
}

function buildSchema(p: PasswordPolicyDto) {
    let rule = yup
        .string()
        .strict(true)
        .trim()
        .required(passwordPolicyText.requiredNewPassword)
        .min(p.minLength, passwordPolicyText.minLength(p.minLength))
        .max(p.maxLength, passwordPolicyText.maxLength(p.maxLength))

    if (p.requireUpper) {
        rule = rule.matches(/[A-Z]/, passwordPolicyText.requireUpper)
    }
    if (p.requireLower) {
        rule = rule.matches(/[a-z]/, passwordPolicyText.requireLower)
    }
    if (p.requireDigit) {
        rule = rule.matches(/[0-9]/, passwordPolicyText.requireDigit)
    }
    if (p.requireSpecial) {
        const specials = p.allowedSpecials || ''
        const escaped = specials.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
        if (escaped.length > 0) {
            rule = rule.matches(new RegExp(`[${escaped}]`), passwordPolicyText.requireSpecial(specials))
        }
    }
    if (!p.allowWhitespace) {
        rule = rule.matches(/^\S*$/, passwordPolicyText.disallowWhitespace)
    }
    return rule
}

const schema = computed(() => {
    const p = policy.value ?? defaultPolicy
    return yup.object({
        currentPassword: yup
            .string()
            .strict(true)
            .required(passwordPolicyText.requiredCurrentPassword),
        newPassword: buildSchema(p),
        confirmPassword: yup
            .string()
            .oneOf([yup.ref('newPassword')], passwordPolicyText.mismatchConfirmPassword)
            .required(passwordPolicyText.requiredConfirmPassword),
    })
})

const effectivePolicy = computed<PasswordPolicyDto>(() => policy.value ?? defaultPolicy)

const { handleSubmit, validateField, resetForm } = useForm({
    validationSchema: schema,
    initialValues: { currentPassword: ' ', newPassword: '', confirmPassword: '' },
    validateOnMount: false,
    validateOnBlur: true,
    validateOnChange: false,
    validateOnInput: false,
} as any)

const { value: currentPassword, errorMessage: currentPasswordError } =
    useField<string>('currentPassword')
const { value: newPassword, errorMessage: newPasswordError } =
    useField<string>('newPassword')
const { value: confirmPassword, errorMessage: confirmPasswordError } =
    useField<string>('confirmPassword')

function handleClose() {
    resetForm()
    model.value = false
}

watch(model, (opened) => {
    if (!opened) return
    // Always open with a clean form state.
    resetForm({ values: { currentPassword: ' ', newPassword: '', confirmPassword: '' } })
    showCurrent.value = false
    showNew.value = false
    showConfirm.value = false
})

const onSubmit = handleSubmit(async (form) => {
    overlay.value = true
    try {
        await changeSelfPassword(form.currentPassword, form.newPassword)
        toast.success('비밀번호 변경 완료!')
        handleClose()
    } catch (e) {
        toast.error(resolveAxiosError(e))
    } finally {
        overlay.value = false
    }
})

onMounted(async () => {
    try {
        policy.value = await getSelfPasswordPolicy()
    } catch (e) {
        toast.error(resolveAxiosError(e))
        policy.value = defaultPolicy
    }
})
</script>
