<template>
    <v-dialog width="650" :fullscreen="false" :scrim="true" transition="dialog-bottom-transition">
        <v-card>
            <PageToolbar title="객체 식별자" @close="handleClose" :closeable="true" :divider="true"
                :items="[{ icon: 'mdi-refresh', event: 'refresh' }]" />
            <v-alert closable rounded="0" icon="mdi-tooltip"
                :text="'종류 (도메인 or 클래스)에 해당하는 객체를 정의합니다. 예를 들어 게시물 도메인이 있다면 게시물 (id:1) 에 대한 ACL을 만드는 것과 같습니다. 전체를 표현하는 경우는 종류 (도메인 or 클래스) 대상 ID 값으로 __root__ 을 입력하세요.'"
                type="info" max-height="100"></v-alert>
            <v-card-text>
                <v-row dense>
                    <v-col cols="12" sm="12">
                        <!-- sid -->
                        <v-select v-model="classId" :items="classesStore.dataItems" item-title="className"
                            item-value="id" label="종류 (도메인 or 클래스)" required density="comfortable" clearable
                            :error="!!classIdError" :error-messages="classIdError"  @blur="validateField('classId')" />
                    </v-col>
                    <v-col cols="12" sm="12">
                        <v-text-field label="종류 (도메인 or 클래스) 대상 ID*" v-model="objectIdentity"
                            :error="!!objectIdentityError" density="comfortable" clearable required
                            :error-messages="objectIdentityError" @blur="validateField('objectIdentity')" />
                    </v-col>
                    <v-col cols="12" sm="12">
                        <v-select v-model="ownerSidId" :items="sidsStore.dataItems" item-title="sid" item-value="id"
                            clearable label="소유자*" density="comfortable" required :error="!!ownerSidIdError"
                            :error-messages="ownerSidIdError" :hint="isRootIdentity
                                    ? '__root__ 객체는 소유자 없이 전역 정책으로 사용됩니다.'
                                    : (sidsStore.dataItems.length === 0
                                        ? '먼저 보안 식별자를 생성하세요'
                                        : undefined)
                                " />
                    </v-col>
                    <v-col cols="12" sm="12">
                        <v-select v-model="parentId" :items="sidsStore.dataItems" item-title="sid" item-value="id"
                            label="부모" density="comfortable" clearable
                            :hint="sidsStore.dataItems.length === 0 ? '먼저 보안 식별자를 생성하세요' : undefined" />
                    </v-col>
                    <v-col cols="12" sm="12">
                        <v-switch v-model="entriesInheriting" :label="entriesInheritingLabel" density="comfortable"
                            inset color="primary" />
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
import { ref, onMounted, watch, computed } from 'vue'
import PageToolbar from '@/components/bars/PageToolbar.vue'

// vee-validate
import { useForm, useField } from 'vee-validate'
import * as yup from 'yup'
import { useConfirm } from '@/plugins/confirm';
import { resolveAxiosError } from '@/utils/helpers';
import { useToast } from '@/plugins/toast';
import { useAclSidsStore } from '@/stores/studio/acl.sids.store';
import { useAclClassesStore } from '@/stores/studio/acl.classes.store';
import { useAclObjectsStore } from '@/stores/studio/acl.objects.store';
import type { AclObjectIdentityRequest } from '@/types/studio/acl';

const toast = useToast();
const confirm = useConfirm();
const classesStore = useAclClassesStore();
const sidsStore = useAclSidsStore();
const objectsStore = useAclObjectsStore();

const props = defineProps({
    // 수정 모드 초기 데이터
    initialData: {
        type: Object as () => {
            classId?: number | null
            objectIdentity?: string | number | null
            ownerSidId?: number | null
            parentId?: number | null
            entriesInheriting?: boolean
        } | undefined,
        default: undefined,
    },
})

const emit = defineEmits<{
    (e: 'close'): void
    (e: 'updated', payload: {
        classId: number | null
        objectIdentity: string | number | null
        ownerSidId: number | null
        parentId: number | null
        entriesInheriting: boolean
    }): void
}>()

/** 유효성 스키마 */
const schema = yup.object({
    classId: yup
        .number()
        .nullable()
        .required('종류(도메인 or 클래스)는 필수입니다.'),
    objectIdentity: yup
        .string()
        .trim()
        .matches(/^[^:]*$/, '":" 문자는 사용할 수 없습니다.')
        .required('대상 객체 ID는 필수입니다.'),
    ownerSidId: yup
        .number()
        .nullable()
        .when('objectIdentity', {
            // objectIdIdentity 가 "__root__" 인 경우 → ownerSid 선택 안 해도 됨
            is: (val: unknown) =>
                typeof val === 'string', // && val.trim() === '__root__',
            then: (schema) => schema.nullable().notRequired(),
            // 그 외에는 기존처럼 필수
            otherwise: (schema) =>
                schema.required('소유자는 필수입니다.'),
        }),
    parentId: yup
        .number()
        .nullable()
        .optional(),
    entriesInheriting: yup.boolean().default(false),
})

/** 폼 설정 */
const { handleSubmit, setFieldValue, validateField, resetForm } = useForm({
    validationSchema: schema,
    initialValues: {
        classId: null as number | null,
        objectIdentity: '' as string | number | null,
        ownerSidId: null as number | null,
        parentId: null as number | null,
        entriesInheriting: false,
    },
    validateOnMount: false,
    validateOnBlur: true,
    validateOnChange: false,
    validateOnInput: false,
})


/** 필드 단위 상태 */
const { value: classId, errorMessage: classIdError } =
    useField<number | null>('classId')

const { value: objectIdentity, errorMessage: objectIdentityError } =
    useField<string | number | null>('objectIdentity')

const { value: ownerSidId, errorMessage: ownerSidIdError } =
    useField<number | null>('ownerSidId')

const { value: parentId } =
    useField<number | null>('parentId')

const { value: entriesInheriting } =
    useField<boolean>('entriesInheriting')

const isRootIdentity = computed(() =>
    String(objectIdentity.value ?? '').trim() === '__root__'
)

// __root__ 로 바뀌면 ownerSid 비우기
watch(objectIdentity, (val) => {
    if (String(val ?? '').trim() === '__root__') {
        ownerSidId.value = null
    }
})

const entriesInheritingLabel = computed(() =>
    entriesInheriting.value
        ? '부모 ACL로부터 권한 상속'
        : '부모 ACL로부터 상속받지 않음'
)


/** 로딩 오버레이 */
const overlay = ref(false)

/** 제출 */
const onSubmit = handleSubmit(async (form) => {
    const ok = await confirm({
        title: '확인',
        message: `새로운 객체 식별자 (class: ${form.classId}, id: ${form.objectIdentity}) 를 생성/수정하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
        okText: '네',
        cancelText: '아니오',
        color: 'primary',
    })
    if (!ok) return

    overlay.value = true
    try {
        // 예: const created = await objectsStore.createObject(form);
        const created = await objectsStore.createObjectIdentity(form as AclObjectIdentityRequest)
        emit('updated', {
            classId: created.objectIdClass ?? form.classId ?? null,
            objectIdentity: created.objectIdIdentity ?? form.objectIdentity ?? null,
            ownerSidId: created.ownerSid ?? form.ownerSidId ?? null,
            parentId: created.parentObject ?? form.parentId ?? null,
            entriesInheriting: created.entriesInheriting ?? form.entriesInheriting ?? true,
        })
        handleClose()
    } catch (e) {
        toast.error(resolveAxiosError(e))
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
    if (a === b) return true
    if (!a || !b) return false
    return (
        a.objectIdClass === b.objectIdClass &&
        a.objectIdentity === b.objectIdentity &&
        a.ownerSidId === b.ownerSidId &&
        a.parentId === b.parentId &&
        a.entriesInheriting === b.entriesInheriting
    )
}


/** 초기값 주입 */
onMounted(() => {
    if (props.initialData) {
        setFieldValue('classId', props.initialData.classId ?? null)
        setFieldValue('objectIdentity', props.initialData.objectIdentity ?? '')
        setFieldValue('ownerSidId', props.initialData.ownerSidId ?? null)
        setFieldValue('parentId', props.initialData.parentId ?? null)
        setFieldValue('entriesInheriting', props.initialData.entriesInheriting ?? false)
    }
})

/** props 변경 반영 */
watch(
    () => props.initialData,
    (v, old) => {
        if (!v || shallowEq(v, old)) return
        setFieldValue('classId', v.classId ?? null)
        setFieldValue('objectIdentity', v.objectIdentity ?? '')
        setFieldValue('ownerSidId', v.ownerSidId ?? null)
        setFieldValue('parentId', v.parentId ?? null)
        setFieldValue('entriesInheriting', v.entriesInheriting ?? false)
    }
)
</script>
