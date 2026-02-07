<template>
    <v-dialog width="650" :fullscreen="false" :scrim="true" transition="dialog-bottom-transition">
        <v-card>
            <PageToolbar title="클래스(FQCN)" @close="handleClose" :closeable="true" :divider="true"
                :items="[{ icon: 'mdi-refresh', event: 'refresh' }]" />
            <v-alert closable rounded="0" icon="mdi-tooltip" 
                :text="'클래스(FQCN) 또는 도메인 객체는 ACL(Access Control List) 이 적용되는 객체의 종류를 정의합니다.'" 
                type="info" max-height="100"></v-alert>    
            <v-card-text>
                <v-row dense>
                    <v-col cols="12" sm="12"> 
                        <!-- name -->
                        <v-text-field label="Name*" v-model="name" :error="!!nameError" :error-messages="nameError"
                            @blur="validateField('name')" />
                    </v-col>
                    <v-col cols="12" sm="12"> 
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
import { ref, onMounted, watch } from 'vue'
import PageToolbar from '@/components/bars/PageToolbar.vue' 

// vee-validate
import { useForm, useField } from 'vee-validate'
import * as yup from 'yup'
import { useAclClassesStore } from '@/stores/studio/mgmt/acl.classes.store';
import { useConfirm } from '@/plugins/confirm';
import { resolveAxiosError } from '@/utils/helpers';
import { useToast } from '@/plugins/toast';

const toast = useToast();
const confirm = useConfirm();
const classesStore = useAclClassesStore();

const props = defineProps({
    // 수정 모드 초기 데이터
    initialData: {
        type: Object as () => { name?: string | null; } | undefined,
        default: undefined,
    },
})
const emit = defineEmits<{
    (e: 'close'): void
    (e: 'updated', payload: any): void
}>()

/** 유효성 스키마: strict로 캐스팅 차단 */
const schema = yup.object({
    name: yup.string().strict(true)
        .required('Name은 필수입니다.')
        .min(2, '최소 2자 이상 입력하세요.')
        .max(50, '최대 50자까지 입력 가능합니다.')
        .matches(/^[^:]*$/, '":" 문자는 사용할 수 없습니다.'), 
})

/** 폼 설정: 입력 중 검증/캐스팅 비활성화 */
const { handleSubmit, setFieldValue, validateField, resetForm } = useForm({
    validationSchema: schema,
    initialValues: { name: '' },
    validateOnMount: false,
    validateOnBlur: true,
    validateOnChange: false,
    validateOnInput: false,
} as any)

/** 필드 단위 상태 */ 
const { value: name, errorMessage: nameError } = useField<string>('name')
/** 로딩 오버레이 */
const overlay = ref(false)

/** 제출 */
const onSubmit = handleSubmit(async (form) => {

    const ok = await confirm({
        title: '확인',
        message: `새로운 도메인/클래스 객체 "${form?.name}" 을 생성하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
        okText: '네',
        cancelText: '아니오',
        color: 'primary',
    });
    if (!ok) return;
    overlay.value = true
    try {
        const create = await classesStore.createClass(form.name); 
        handleClose()
    } catch (e) {
        toast.error(resolveAxiosError(e));
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
    return a.name === b.name 
}

onMounted(() => {
    if (props.initialData) {
        setFieldValue('name', props.initialData.name ?? '') 
    }
})

watch(
    () => props.initialData,
    (v, old) => {
        if (!v || shallowEq(v, old)) return
        setFieldValue('name', v.name ?? '') 
    }
)
</script>
