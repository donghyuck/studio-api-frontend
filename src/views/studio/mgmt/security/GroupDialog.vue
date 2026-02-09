<template>
    <v-dialog :key="groupId" width="650" :fullscreen="false" :scrim="true" transition="dialog-bottom-transition">
        <v-card>
            <PageToolbar title="Group" @close="handleClose" :closeable="true" :divider="true"
                :items="[{ icon: 'mdi-refresh', event: 'refresh' }]" />
            <v-card-text>
                <v-row dense>
                    <v-col cols="12" sm="12">
                        <!-- name -->
                        <v-text-field label="Name*" v-model="name" :error="!!nameError" :error-messages="nameError"
                            @blur="validateField('name')" />
                    </v-col>
                    <v-col cols="12" sm="12">
                        <!-- description -->
                        <v-textarea label="Description" rows="2" row-height="20" v-model="description"
                            :error="!!descriptionError" :error-messages="descriptionError"
                            @blur="validateField('description')" />
                    </v-col>
                </v-row>
            </v-card-text>
            <v-divider />
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
import { ref, onMounted, watch } from 'vue'
import PageToolbar from '@/components/bars/PageToolbar.vue'
import { usePageableGroupsStore } from '@/stores/studio/mgmt/groups.store'

// vee-validate
import { useForm, useField } from 'vee-validate'
import * as yup from 'yup'

import { useToast } from '@/plugins/toast'
import { useConfirm } from '@/plugins/confirm'

const toast = useToast();
const confirm = useConfirm();

const props = defineProps({
    groupId: { type: Number, default: 0 },
    // 수정 모드 초기 데이터
    initialData: {
        type: Object as () => { name?: string | null; description?: string | null; properties?: Record<string, any> } | undefined,
        default: undefined,
    },
})
const emit = defineEmits<{
    (e: 'close'): void
    (e: 'updated', payload: any): void
}>()

const store = usePageableGroupsStore()

/** 유효성 스키마: strict로 캐스팅 차단 */
const schema = yup.object({
    name: yup.string().strict(true)
        .required('Name은 필수입니다.')
        .min(2, '최소 2자 이상 입력하세요.')
        .max(50, '최대 50자까지 입력 가능합니다.'),
    description: yup.string().strict(true)
        .max(500, '최대 500자까지 입력 가능합니다.'),
})

/** 폼 설정: 입력 중 검증/캐스팅 비활성화 */
const { handleSubmit, setFieldValue, validateField, resetForm } = useForm({
    validationSchema: schema,
    initialValues: { name: '', description: '' },
    validateOnMount: false,
    validateOnBlur: true,
    validateOnChange: false,
    validateOnInput: false,
} as any)

/** 필드 단위 상태 */
const { value: name, errorMessage: nameError } = useField<string>('name')
const { value: description, errorMessage: descriptionError } = useField<string>('description')

/** 로딩 오버레이 */
const overlay = ref(false)

/** 제출 */
const onSubmit = handleSubmit(async (form) => {
    overlay.value = true
    try {
        const created = await store.create({
            name: form.name,
            description: form.description ?? '',
            properties: {},
        })
        emit('updated', created)
        handleClose()
    } catch (e) {
        console.error(e)
    } finally {
        overlay.value = false
    }
})

/** 닫기: 여기서만 초기화 */
function handleClose() {
    resetForm()
    emit('close')
}

/** 초기값 주입: 실제 변경시에만 반영 */
function shallowEq(a?: any, b?: any) {
    if (a === b) return true
    if (!a || !b) return false
    return a.name === b.name && a.description === b.description
}

onMounted(() => {
    if (props.initialData) {
        setFieldValue('name', props.initialData.name ?? '')
        setFieldValue('description', props.initialData.description ?? '')
    }
})

watch(
    () => props.initialData,
    (v, old) => {
        if (!v || shallowEq(v, old)) return
        setFieldValue('name', v.name ?? '')
        setFieldValue('description', v.description ?? '')
    }
)
</script>
