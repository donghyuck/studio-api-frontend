<template>
    <v-dialog width="650" :fullscreen="false" :scrim="true" transition="dialog-bottom-transition">
        <v-card>
            <PageToolbar title="대상(사용자 or 롤)" @close="handleClose" :closeable="true" :divider="true"
                :items="[{ icon: 'mdi-refresh', event: 'refresh' }]" />
            <v-alert closable rounded="0" icon="mdi-tooltip" :text="'대상(사용자 or 롤) 정의합니다. 롤은 ROLE_ 접두어를 제외하고 입력합니다.'" type="info"
                max-height="100"></v-alert>
            <v-card-text>
                <v-row dense>
                    <v-col cols="12" sm="12">
                        <!-- sid -->
                        <v-text-field label="Sid*" v-model="sid" :error="!!sidError" :error-messages="sidError"
                            @blur="validateField('sid')" />
                    </v-col>
                    <v-col cols="12" sm="12">
                        <v-switch v-model="principal" :label="principalLabel" inset color="primary" />
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
import { ref, onMounted, watch, computed } from 'vue'
import PageToolbar from '@/components/bars/PageToolbar.vue'

// vee-validate
import { useForm, useField } from 'vee-validate'
import * as yup from 'yup'
import { useConfirm } from '@/plugins/confirm';
import { resolveAxiosError } from '@/utils/helpers';
import { useToast } from '@/plugins/toast';
import { useAclSidsStore } from '@/stores/studio/mgmt/acl.sids.store';

const toast = useToast();
const confirm = useConfirm();
const sidsStore = useAclSidsStore();

const props = defineProps({
    // 수정 모드 초기 데이터
    initialData: {
        type: Object as () => { sid?: string | null; principal?: boolean; } | undefined,
        default: undefined,
    },
})
const emit = defineEmits<{
    (e: 'close'): void
    (e: 'updated', payload: { sid: string; principal: boolean }): void
}>()

/** 유효성 스키마: strict로 캐스팅 차단 */
const schema = yup.object({
    sid: yup.string().strict(true)
        .required('SID 은 필수입니다.')
        .min(2, '최소 2자 이상 입력하세요.')
        .max(50, '최대 50자까지 입력 가능합니다.'),
    principal: yup.boolean().default(false),
})

/** 폼 설정: 입력 중 검증/캐스팅 비활성화 */
const { handleSubmit, setFieldValue, validateField, resetForm } = useForm({
    validationSchema: schema,
    initialValues: { sid: '', principal: false },
    validateOnMount: false,
    validateOnBlur: true,
    validateOnChange: false,
    validateOnInput: false,
} as any)

/** 필드 단위 상태 */
const { value: sid, errorMessage: sidError } = useField<string>('sid')
const { value: principal } = useField<boolean>('principal')

const principalLabel = computed(() =>
  principal.value ? '보안 대상 유형: 사용자(Principal)' : '보안 대상 유형: 권한 / 롤(ROLE)'
)

/** 로딩 오버레이 */
const overlay = ref(false)

/** 제출 */
const onSubmit = handleSubmit(async (form) => {

    const ok = await confirm({
        title: '확인',
        message: `새로운 보안 대상(사용자 or 권한) "${form?.sid}" 을 생성하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
        okText: '네',
        cancelText: '아니오',
        color: 'primary',
    });
    if (!ok) return;
    overlay.value = true
    try {
        const create = await sidsStore.createSid(form.sid, form.principal);
        emit('updated', { sid: form.sid, principal: form.principal ?? false });
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
function shallowEq(a?: any, b?: any) {
    if (a === b) return true;
    if (!a || !b) return false;
    return a.sid === b.sid && a.principal === b.principal;
}

/** 초기값 주입 */
onMounted(() => {
    if (props.initialData) {
        setFieldValue('sid', props.initialData.sid ?? '');
        setFieldValue('principal', props.initialData.principal ?? false);
    }
})

/** props 변경 반영 */
watch(
    () => props.initialData,
    (v, old) => {
        if (!v || shallowEq(v, old)) return;
        setFieldValue('sid', v.sid ?? '');
        setFieldValue('principal', v.principal ?? false);
    }
)
</script>
