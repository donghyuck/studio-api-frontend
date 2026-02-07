<template>
    <v-breadcrumbs class="pa-0" :items="['응용프로그램', '자원', '템플릿']" density="compact"></v-breadcrumbs>
    <PageToolbar title="템플릿 목록" label="" :previous="true" :closeable="false" :divider="true" :items="[
        { icon: 'mdi-refresh', event: 'refresh', }]" @refresh="refresh"></PageToolbar>
    <v-card class="mt-2">
        <v-card-text>
            <v-row no-gutters>
                <v-col cols="12">
                    <v-skeleton-loader type="article" :loading="loading" min-width="100%">
                        <v-row>
                            <v-col cols="6" class="pb-0">
                                <v-text-field label="Name*" v-model="name" hint="영문 이름을 입력하세요." readonly
                                    density="compact" :error="!!errors.name" :error-messages="errors.name"
                                    @blur="validateField('name')" />
                            </v-col>
                            <v-col cols="6" class="pb-0">
                                <v-text-field label="한글 이름" v-model="displayName" density="compact" />
                            </v-col>
                            <v-col cols="3" class="pb-0">
                                <v-number-input v-model="objectType" :reverse="false" controlVariant="default"
                                    label="객체 유형" :hideInput="false" hide-details density="compact" :min="0"
                                    :inset="false"></v-number-input>
                            </v-col>
                            <v-col cols="3" class="pb-0">
                                <v-number-input v-model="objectId" :reverse="false" controlVariant="default"
                                    label="객체 식별자" :hideInput="false" hide-details density="compact" :min="0"
                                    :inset="false"></v-number-input>
                            </v-col>
                            <v-col cols="6" class="pb-0">
                                <v-textarea label="설명" rows="1" density="compact" v-model="description" counter
                                    hide-details></v-textarea>
                            </v-col>
                            <v-col cols="12">
                                <v-text-field label="Subject" v-model="subject" density="compact" hide-details />
                            </v-col>
                        </v-row>
                    </v-skeleton-loader>
                </v-col>
            </v-row>
        </v-card-text>
        <v-divider class="border-opacity-100" color="success" />
        <v-card-item class="pa-0">
            <v-toolbar density="compact" dense class="pa-2">
                <v-select class="ml-2" v-model="aceLangSelected" :items="aceLangOptions" label="Language" density="compact"
                    variant="outlined" hide-details style="max-width: 180px" />
                <v-select class="ml-2" v-model="aceThemeSelected" :items="aceThemeOptions" label="Theme" density="compact"
                    variant="outlined" hide-details style="max-width: 200px" />
                <v-spacer></v-spacer>
                <v-switch v-model="wordWrap" label="Word wrap" density="compact" variant="outlined" hide-details
                    class="mr-5" />
            </v-toolbar>
        </v-card-item>
        <v-card-text class="pa-0">
            <v-ace-editor v-if="aceReady" v-model:value="body" :lang="aceLangApplied" :theme="aceThemeApplied"
                :options="{ useWorker: true, wrap: wordWrap }" style="min-height: 360px; height:100%; width: 100%;" />
        </v-card-text>
        <v-card-actions>
            <PreviewTemplateDialog :templateId="templateId"></PreviewTemplateDialog>
            <v-spacer />
            <v-btn variant="tonal" color="grey" rounded="xl" width="100"
                @click="hasHistory() ? $router.go(-1) : $router.push('/')">
                Cancel
            </v-btn>
            <v-btn variant="outlined" prepend-icon="mdi-content-save" rounded="xl" color="primary" width="100"
                density="default" :loading="saving" @click="onSubmit">
                Save
            </v-btn>
        </v-card-actions>
    </v-card>
    <v-overlay v-model="overlay" contained class="align-center justify-center">
        <v-progress-circular color="primary" indeterminate size="64" />
    </v-overlay>


</template>
<script setup lang="ts">
import PageToolbar from '@/components/bars/PageToolbar.vue';
import { loadAce } from '@/components/ace';
import { updateTemplate } from '@/data/studio/mgmt/template';
import { useConfirm } from '@/plugins/confirm';
import { useToast } from '@/plugins/toast';
import { usePageableTemplateStore } from '@/stores/studio/mgmt/template.store';
import type { TemplateRequest } from '@/types/studio/template';
import { hasHistory, resolveAxiosError } from '@/utils/helpers';
import { onMounted, ref, watch } from 'vue';
import { VAceEditor } from 'vue3-ace-editor';
import { useForm } from 'vee-validate';
import * as yup from 'yup';
import PreviewTemplateDialog from './PreviewTemplateDialog.vue';
const toast = useToast();
const confirm = useConfirm();
const overlay = ref(false);
const loading = ref(true);
const saving = ref(false);
const wordWrap = ref(false);
const aceReady = ref(false);
const aceLoadSeq = ref(0);
const aceLangOptions = ["text", "html", "javascript", "json", "css", "yaml", "sql", "java"];
const aceThemeOptions = ["chrome", "github", "monokai", "solarized_dark", "solarized_light", "tomorrow_night", "twilight"];
const aceLangSelected = ref("html");
const aceThemeSelected = ref("chrome");
const aceLangApplied = ref("html");
const aceThemeApplied = ref("chrome");

const props = defineProps({
    templateId: { type: Number, default: 0 },
});

const dataStore = usePageableTemplateStore();

const templateProperties = ref<Record<string, string> | null>(null);

const schema = yup.object({
    name: yup.string().strict(true).required('Name은 필수입니다.'),
    displayName: yup.string().nullable(),
    description: yup.string().nullable(),
    subject: yup.string().nullable(),
    body: yup.string().nullable(),
    objectType: yup.number().integer().min(0).required(),
    objectId: yup.number().integer().min(0).required(),
});

const blank = {
    name: '',
    displayName: null,
    description: null,
    subject: null,
    body: null,
    objectType: 0,
    objectId: 0,
};

const {
    errors,
    handleSubmit,
    resetForm,
    validateField,
    useFieldModel,
} = useForm({
    validationSchema: schema,
    initialValues: blank,
    validateOnMount: false,
    validateOnBlur: true,
    validateOnChange: false,
    validateOnInput: false,
} as any);

const [
    name,
    displayName,
    description,
    subject,
    body,
    objectType,
    objectId,
] = useFieldModel([
    'name',
    'displayName',
    'description',
    'subject',
    'body',
    'objectType',
    'objectId',
]);

async function getData() {
    overlay.value = true;
    try {
        loading.value = true;
        const data = await dataStore.byId(props.templateId, true) 
        if (data) {
            templateProperties.value = data.properties ?? null;
            resetForm({
                values: {
                    name: data.name ?? '',
                    displayName: data.displayName ?? null,
                    description: data.description ?? null,
                    subject: data.subject ?? null,
                    body: data.body ?? null,
                    objectType: data.objectType ?? 0,
                    objectId: data.objectId ?? 0,
                },
            });
        }
    } finally {
        loading.value = false;
        overlay.value = false;
    }
}

const refresh = () => {
    getData()
}

const syncAce = async () => {
    const seq = ++aceLoadSeq.value;
    await loadAce(aceLangSelected.value, aceThemeSelected.value);
    if (seq !== aceLoadSeq.value) return;
    aceLangApplied.value = aceLangSelected.value;
    aceThemeApplied.value = aceThemeSelected.value;
    aceReady.value = true;
};

onMounted(() => {
    if (props.templateId > 0) {
        getData();
    }
    syncAce();
});

watch([aceLangSelected, aceThemeSelected], () => {
    syncAce();
});

const onSubmit = handleSubmit(async (form) => {
    if (!Number.isFinite(props.templateId) || props.templateId <= 0) return;
    const ok = await confirm({
        title: '저장 확인',
        message: '현재 내용을 저장하시겠습니까?',
        okText: '저장',
        cancelText: '취소',
        color: 'primary',
    });
    if (!ok) return;
    saving.value = true;
    try {
        await updateTemplate(
            props.templateId,
            {
                ...form,
                properties: templateProperties.value ?? {},
            } as TemplateRequest
        );
        toast.success('저장 완료!');
        await getData();
    } catch (e) {
        toast.error(resolveAxiosError(e));
    } finally {
        saving.value = false;
    }
});
</script>
