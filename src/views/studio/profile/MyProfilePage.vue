<template>
    <v-breadcrumbs class="pa-0" :items="['내 정보', '프로필 수정']" density="compact"></v-breadcrumbs>
    <PageToolbar title="My Profile" :closeable="false" :divider="true"
        :items="[{ icon: 'mdi-refresh', event: 'refresh' }]" @refresh="load" />

    <v-card class="mb-4">
        <v-card-title class="text-subtitle-1">사용자 정보</v-card-title>
        <v-card-text>
            <v-row dense>
                <v-col cols="12" md="6">
                    <v-text-field label="아이디" :model-value="profile.username" readonly variant="outlined" />
                </v-col>
                <v-col cols="12" md="6">
                    <v-text-field label="이메일*" v-model="email" :error-messages="emailError ? [emailError] : []"
                        variant="outlined" @blur="validateField('email')" />
                </v-col>
                <v-col cols="12" md="6">
                    <v-text-field label="이름*" v-model="name" :error-messages="nameError ? [nameError] : []"
                        variant="outlined" @blur="validateField('name')" />
                </v-col>
                <v-col cols="12" md="6">
                    <v-text-field label="이름(First)" v-model="firstName"
                        :error-messages="firstNameError ? [firstNameError] : []" variant="outlined"
                        @blur="validateField('firstName')" />
                </v-col>
                <v-col cols="12" md="6">
                    <v-text-field label="성(Last)" v-model="lastName"
                        :error-messages="lastNameError ? [lastNameError] : []" variant="outlined"
                        @blur="validateField('lastName')" />
                </v-col>
            </v-row>
        </v-card-text>
        <v-divider />
        <v-card-actions>
            <v-spacer />
            <v-btn color="primary" variant="outlined" prepend-icon="mdi-content-save" @click="onSave" :loading="saving">
                저장
            </v-btn>
        </v-card-actions>
    </v-card>

    <v-card>
        <v-card-title class="text-subtitle-1">인증 자동 연장 설정</v-card-title>
        <v-card-text>
            <v-row dense>
                <v-col cols="12" md="6">
                    <v-switch v-model="autoRefreshEnabled" density="compact" hide-details inset color="primary"
                        label="자동 연장 사용" />
                </v-col>
                <v-col cols="12" md="6">
                    <v-select v-model="autoRefreshWindowMin" :items="[5, 10, 15, 30]" density="comfortable"
                        hide-details variant="outlined" label="자동 연장 시작(분)" />
                </v-col>
                <v-col cols="12">
                    <v-alert type="info" variant="tonal" density="comfortable">
                        이 설정은 현재 브라우저에 저장되며, 변경 즉시 적용됩니다.
                    </v-alert>
                </v-col>
            </v-row>
        </v-card-text>
    </v-card>
</template>

<script setup lang="ts">
import PageToolbar from '@/components/bars/PageToolbar.vue'
import { getSelfProfile, patchSelfProfile } from '@/data/studio/auth'
import { useToast } from '@/plugins/toast'
import { useAuthStore } from '@/stores/studio/mgmt/auth.store'
import { usePreferencesStore } from '@/stores/studio/mgmt/preferences.store'
import type { MeProfileDto } from '@/types/studio/user'
import { resolveAxiosError } from '@/utils/helpers'
import { useField, useForm } from 'vee-validate'
import { computed, onMounted, reactive, ref } from 'vue'
import * as yup from 'yup'

const auth = useAuthStore()
const prefs = usePreferencesStore()
const toast = useToast()
const saving = ref(false)

const autoRefreshEnabled = computed({
    get: () => prefs.autoRefreshEnabled,
    set: (val: boolean) => { prefs.autoRefreshEnabled = val },
})

const autoRefreshWindowSec = computed({
    get: () => prefs.autoRefreshWindowSec,
    set: (val: number) => { prefs.autoRefreshWindowSec = Number(val) },
})

const autoRefreshWindowMin = computed({
    get: () => Math.max(1, Math.floor(autoRefreshWindowSec.value / 60)),
    set: (val: number) => { autoRefreshWindowSec.value = Number(val) * 60 },
})

const profile = reactive<MeProfileDto & { firstName?: string | null; lastName?: string | null }>({
    userId: 0,
    username: '',
    name: '',
    email: '',
    firstName: '',
    lastName: '',
})

const schema = yup.object({
    name: yup.string().trim().required('이름은 필수입니다.').max(100, '이름은 최대 100자까지 가능합니다.'),
    email: yup.string().trim().email('올바른 이메일 형식이 아닙니다.').required('이메일은 필수입니다.').max(255, '이메일은 최대 255자까지 가능합니다.'),
    firstName: yup.string().trim().max(100, '이름(First)은 최대 100자까지 가능합니다.'),
    lastName: yup.string().trim().max(100, '성(Last)은 최대 100자까지 가능합니다.'),
})

const { handleSubmit, resetForm, validateField } = useForm({
    validationSchema: schema,
    initialValues: { name: '', email: '', firstName: '', lastName: '' },
    validateOnMount: false,
    validateOnBlur: true,
    validateOnChange: false,
    validateOnInput: false,
} as any)

const { value: name, errorMessage: nameError } = useField<string>('name')
const { value: email, errorMessage: emailError } = useField<string>('email')
const { value: firstName, errorMessage: firstNameError } = useField<string>('firstName')
const { value: lastName, errorMessage: lastNameError } = useField<string>('lastName')

async function load() {
    try {
        const me = await getSelfProfile() as MeProfileDto & { firstName?: string | null; lastName?: string | null }
        profile.userId = me.userId
        profile.username = me.username
        profile.name = me.name || ''
        profile.email = me.email || ''
        profile.firstName = me.firstName || ''
        profile.lastName = me.lastName || ''
        resetForm({
            values: {
                name: profile.name,
                email: profile.email || '',
                firstName: profile.firstName || '',
                lastName: profile.lastName || '',
            },
        })
    } catch (e) {
        toast.error(resolveAxiosError(e))
    }
}

const onSave = handleSubmit(async (form) => {
    saving.value = true
    try {
        const updated = await patchSelfProfile({
            name: form.name,
            email: form.email,
            firstName: form.firstName || undefined,
            lastName: form.lastName || undefined,
        }) as MeProfileDto & { firstName?: string | null; lastName?: string | null }
        profile.name = updated.name || form.name
        profile.email = updated.email || form.email
        profile.firstName = updated.firstName ?? form.firstName ?? ''
        profile.lastName = updated.lastName ?? form.lastName ?? ''
        resetForm({
            values: {
                name: profile.name,
                email: profile.email || '',
                firstName: profile.firstName || '',
                lastName: profile.lastName || '',
            },
        })
        await auth.fetchUser()
        toast.success('프로필이 저장되었습니다.')
    } catch (e) {
        toast.error(resolveAxiosError(e))
    } finally {
        saving.value = false
    }
})

onMounted(load)
</script>
