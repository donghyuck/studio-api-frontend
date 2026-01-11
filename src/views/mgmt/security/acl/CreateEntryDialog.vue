<template>
    <v-dialog width="650" :fullscreen="false" :scrim="true" transition="dialog-bottom-transition">
        <v-card>
            <PageToolbar title="접근 권한 엔트리" @close="handleClose" :closeable="true" :divider="true"
                :items="[{ icon: 'mdi-refresh', event: 'refresh' }]" />
            <v-alert closable rounded="0" icon="mdi-tooltip"
                :text="'특정 객체(acl_object_identity)에 대해 누구(SID)에게 어떤 권한(mask)을 허용/거부할지 한 줄씩 정의합니다.'" type="info"
                max-height="100"></v-alert>
            <v-card-text>
                <v-row dense>
                    <v-col cols="12" sm="12">
                        <v-select v-model="objectIdentityId" :items="objectIdentityItems" item-title="label"
                            item-value="id" label="대상 객체 (Object Identity)*" required density="comfortable" clearable
                            :hint="objectIdentityId != null ? `선택된 ID: ${objectIdentityId}` : undefined" persistent-hint
                            :error="!!objectIdentityIdError" @blur="validateField('objectIdentityId')" />
                    </v-col>
                    <v-col cols="12" sm="12">
                        <v-select v-model="sidId" :items="sidsStore.dataItems" item-title="sid" item-value="id"
                            label="대상(사용자 or 롤)" required density="comfortable" clearable :error="!!sidIdError"
                            @blur="validateField('sidId')" />
                    </v-col>
                    <v-col cols="12" sm="12">
                        <v-text-field v-model="aceOrder" label="평가 순서" type="number" min="0" density="comfortable" /> 
                        <v-select v-model="mask" :items="actions" item-title="action" item-value="mask"
                            label="권한(마스크 값)" required density="comfortable" clearable :error="!!sidIdError" 
                            @blur="validateField('mask')" /> 
                        <v-switch v-model="granting" :label="grantingLabel" inset color="primary" />
                        <v-switch v-model="auditSuccess" label="성공시 감사" inset color="primary" />
                        <v-switch v-model="auditFailure" label="실패시 감사" inset color="primary" />

                    </v-col>
                    <v-col cols="12" sm="12">
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
                <v-btn variant="outlined" prepend-icon="mdi-content-save" rounded="xl" color="primary" width="100" @click="onSubmit">     >
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
import PageToolbar from '@/components/bars/PageToolbar.vue';
import { fetchActions } from '@/data/studio/acl';
import { useConfirm } from '@/plugins/confirm';
import { useToast } from '@/plugins/toast';
import { useAclClassesStore } from '@/stores/studio/acl.classes.store';
import { useAclEntriesStore } from '@/stores/studio/acl.entries.store';
import { useAclObjectsStore } from '@/stores/studio/acl.objects.store';
import { useAclSidsStore } from '@/stores/studio/acl.sids.store';
import type { AclEntryRequest } from '@/types/studio/acl';
import type { AclActionMaskDto } from '@/types/studio/ai';
import { resolveAxiosError } from '@/utils/helpers';
import { useField, useForm } from 'vee-validate';
import { computed, onMounted, ref, watch } from 'vue';
import * as yup from 'yup';

const classesStore = useAclClassesStore();
const sidsStore = useAclSidsStore();
const objectsStore = useAclObjectsStore();
const entriesStore = useAclEntriesStore();

const toast = useToast();
const confirm = useConfirm();
const overlay = ref(false);
const props = defineProps({
    // 수정 모드 초기 데이터
    initialData: {
        type: Object as () => {
            objectIdentityId?: number | null
            sidId?: number | null
            aceOrder?: number | null
            mask?: number | null
            granting?: boolean
            auditSuccess?: boolean
            auditFailure?: boolean
        } | undefined,
        default: undefined,
    },
})

const emit = defineEmits<{
    (e: 'close'): void
    (e: 'updated', payload: {
        objectIdentityId?: number | null
        sidId?: number | null
        aceOrder?: number | null
        mask?: number | null
        granting?: boolean
        auditSuccess?: boolean
        auditFailure?: boolean
    }): void
}>()

const objectIdentityItems = computed(() =>
    objectsStore.dataItems.map((o: any) => ({
        id: o.id,
        label: `#${o.id} - ${o.className} <${o.objectIdentity === '__root__' ? '전체' : o.objectIdentity  }>`,
    })),
)

/** 유효성 스키마 */
const schema = yup.object({
    objectIdentityId: yup
        .number()
        .nullable()
        .required('대상 객체(Object Identity)는 필수입니다.'),
    sidId: yup
        .number()
        .nullable()
        .required('대상 (사용자 or 롤) SID는 필수입니다.'),
    aceOrder: yup
        .number()
        .nullable()
        .transform((v, orig) => (orig === '' || orig === null ? null : v))
        .optional(),
    mask: yup
        .number()
        .nullable()
        .transform((v, orig) => (orig === '' || orig === null ? null : v))
        .required('권한을 나타내는 마스크(mask)는 필수입니다.'),
    granting: yup.boolean().default(false),
    auditSuccess: yup.boolean().default(false),
    auditFailure: yup.boolean().default(false),
})

const { handleSubmit, setFieldValue, validateField, resetForm } = useForm({
    validationSchema: schema,
    initialValues: {
        objectIdentityId: null as number | null,
        sidId: null as number | null,
        aceOrder: 0 as number | null,
        mask: null as number | null,
        granting: true,
        auditSuccess: false,
        auditFailure: false,
    },
    validateOnMount: false,
    validateOnBlur: true,
    validateOnChange: false,
    validateOnInput: false,
})

/** 필드 단위 상태 */
const { value: objectIdentityId, errorMessage: objectIdentityIdError } =
    useField<number | null>('objectIdentityId')

const { value: sidId, errorMessage: sidIdError } =
    useField<number | null>('sidId')

const { value: aceOrder } =
    useField<number | null>('aceOrder')

const { value: mask, errorMessage: maskError } =
    useField<number | null>('mask')

const { value: granting } =
    useField<boolean>('granting')

const { value: auditSuccess } =
    useField<boolean>('auditSuccess')

const { value: auditFailure } =
    useField<boolean>('auditFailure')

const grantingLabel = computed(() =>
    granting.value ? '권한 허용(Granting)' : '권한 거부(Deny)',
)


const onSubmit = handleSubmit(async (form) => {
    const ok = await confirm({
        title: '확인',
        message: `새로운 ACL 엔트리 (object: ${form.objectIdentityId}, sid: ${form.sidId}) 를 생성/수정하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
        okText: '네',
        cancelText: '아니오',
        color: 'primary',
    })
    if (!ok) return

    overlay.value = true
    try {
        const created = await entriesStore.createEntry(form as AclEntryRequest)
        emit('updated', {
            objectIdentityId: created.aclObjectIdentity ?? form.objectIdentityId ?? null,
            sidId: created.sid ?? form.sidId ?? null,
            aceOrder: created.aceOrder ?? form.aceOrder ?? 0,
            mask: created.mask ?? form.mask ?? null,
            granting: created.granting ?? form.granting ?? true,
            auditSuccess: created.auditSuccess ?? form.auditSuccess ?? false,
            auditFailure: created.auditFailure ?? form.auditFailure ?? false,
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
        a.objectIdentityId === b.objectIdentityId &&
        a.sidId === b.sidId &&
        a.aceOrder === b.aceOrder &&
        a.mask === b.mask &&
        a.granting === b.granting &&
        a.auditSuccess === b.auditSuccess &&
        a.auditFailure === b.auditFailure
    )
}

const actions = ref<AclActionMaskDto[]>();
async function loadActions() {
    try {
        const data = await fetchActions();
        actions.value = [...data];
    } catch (e: any) {
        toast.error(resolveAxiosError(e));
    }
}


/** 초기값 주입 */
onMounted(() => {
    if (props.initialData) {
        setFieldValue('objectIdentityId', props.initialData.objectIdentityId ?? null)
        setFieldValue('sidId', props.initialData.sidId ?? null)
        setFieldValue('aceOrder', props.initialData.aceOrder ?? 0)
        setFieldValue('mask', props.initialData.mask ?? null)
        setFieldValue('granting', props.initialData.granting ?? true)
        setFieldValue('auditSuccess', props.initialData.auditSuccess ?? false)
        setFieldValue('auditFailure', props.initialData.auditFailure ?? false)
    }
    loadActions();
})

/** props 변경 반영 */
watch(
    () => props.initialData,
    (v, old) => {
        if (!v || shallowEq(v, old)) return
        setFieldValue('objectIdentityId', v.objectIdentityId ?? null)
        setFieldValue('sidId', v.sidId ?? null)
        setFieldValue('aceOrder', v.aceOrder ?? 0)
        setFieldValue('mask', v.mask ?? null)
        setFieldValue('granting', v.granting ?? true)
        setFieldValue('auditSuccess', v.auditSuccess ?? false)
        setFieldValue('auditFailure', v.auditFailure ?? false)
    },
)
</script>