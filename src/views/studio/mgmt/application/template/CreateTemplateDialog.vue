<template>
    <v-dialog width="650" :fullscreen="fullscreen" :scrim="true" transition="dialog-bottom-transition">
        <v-card>
            <PageToolbar title="새로운 템플릿" @close="handleClose" @fullscreen="toggleFullscreen" :closeable="true"
                :divider="true" :items="[
                    { icon: fullscreenIcon, event: 'fullscreen' },
                ]" />
            <v-card-text class="pa-0 bg-grey-lighten-5">
                <v-container>
                    <v-row>
                        <v-col cols="6" class="pb-0">
                            <v-text-field label="Name*" v-model="name" hint="영문 이름을 입력하세요." density="compact" clearable
                                :error="!!nameError" :error-messages="nameError"
                                @blur="validateField('name')"></v-text-field>
                        </v-col>
                        <v-col cols="6" class="pb-0">
                            <v-text-field v-model="newTemplate.displayName" label="한글 이름"  hint="한글 이름을 입력하세요." density="compact" clearable></v-text-field>
                        </v-col>
                        <v-col cols="3" class="pb-0">
                            <v-number-input v-model="newTemplate.objectType" :reverse="false" controlVariant="default"
                                label="객체 유형" :hideInput="false" hide-details density="compact" :min="0"
                                :inset="false"></v-number-input>
                        </v-col>
                        <v-col cols="3" class="pb-0">
                            <v-number-input v-model="newTemplate.objectId" :reverse="false" controlVariant="default"
                                label="객체 식별자" :hideInput="false" hide-details density="compact" :min="0"
                                :inset="false"></v-number-input>
                        </v-col>
                        <v-col cols="6">
                            <v-textarea label="설명" rows="1" row-height="18" density="compact" v-model="newTemplate.description" counter hint="텝플릿에 대한 설명을 입력하세요."
                                hide-details></v-textarea>
                        </v-col>
                    </v-row>
                </v-container>
            </v-card-text>
            <v-divider class="border-opacity-100" color="success" />
            <v-container class="pa-0">
                <v-card-text class="pa-0">
                    <v-toolbar density="compact" class="pa-2" dense>
                        <v-select class="ml-2" v-model="aceLangSelected" :items="aceLangOptions" label="Language"
                            density="compact" variant="outlined" hide-details style="max-width: 180px" />
                        <v-select class="ml-2" v-model="aceThemeSelected" :items="aceThemeOptions" label="Theme"
                            density="compact" variant="outlined" hide-details style="max-width: 200px" />
                        <v-spacer></v-spacer>
                        <v-switch v-model="wordWrap" label="Word wrap" density="compact" variant="outlined" hide-details
                            class="mr-5" />
                    </v-toolbar>
                    <v-ace-editor v-if="aceReady" v-model:value="templateBody" :lang="aceLangApplied" :theme="aceThemeApplied"
                        :options="{ useWorker: true, wrap: wordWrap }"
                        style="min-height: 360px; height:100%; width: 100%;" />

                </v-card-text>
            </v-container>
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
import PageToolbar from '@/components/bars/PageToolbar.vue';
import { resolveAxiosError } from '@/utils/helpers';
import { computed, onMounted, ref, watch } from 'vue';
import { VAceEditor } from "vue3-ace-editor";
import { loadAce } from '@/components/ace';
import { useConfirm } from '@/plugins/confirm';
import { useToast } from '@/plugins/toast';
import { createTemplate } from '@/data/studio/mgmt/template';
import type { TemplateRequest } from '@/types/studio/template';
import { useForm, useField } from 'vee-validate';
import * as yup from 'yup';
const toast = useToast();
const confirm = useConfirm();
const fullscreen = ref(false);
const overlay = ref(false);
const wordWrap = ref(false);
const aceReady = ref(false);
const aceLoadSeq = ref(0);
const aceLangOptions = ["text", "html", "javascript", "json", "css", "yaml", "sql", "java"];
const aceThemeOptions = ["chrome", "github", "monokai", "solarized_dark", "solarized_light", "tomorrow_night", "twilight"];
const aceLangSelected = ref("html");
const aceThemeSelected = ref("chrome");
const aceLangApplied = ref("html");
const aceThemeApplied = ref("chrome");

const schema = yup.object({
    name: yup.string().strict(true).required('Name은 필수입니다.')
});

const { handleSubmit, setFieldValue, validateField, resetForm } = useForm({
    validationSchema: schema,
    initialValues: { name: '' },
    validateOnMount: false,
    validateOnBlur: true,
    validateOnChange: false,
    validateOnInput: false,
} as any);

const { value: name, errorMessage: nameError } = useField<string>('name');

const newTemplate = ref<TemplateRequest>({
    objectType: 0,
    objectId: 0,
    name: '',
    displayName: null,
    description: null,
    subject: null,
    body: null,
    properties: {}
});

const templateBody = computed({
    get: () => newTemplate.value.body ?? "",
    set: (v: string) => {
        newTemplate.value.body = v;
    },
});

const emit = defineEmits<{
    (e: 'close'): void
    (e: 'updated', payload: any): void
    (e: 'complete', payload: any): void
}>()

const toggleFullscreen = () => {
    fullscreen.value = !fullscreen.value;
}
const fullscreenIcon = computed(() => {
    if (fullscreen)
        return 'mdi-fullscreen-exit';
    else
        return 'mdi-fullscreen';
});
const handleClose = () => {
    resetForm();
    newTemplate.value = {
        objectType: 0,
        objectId: 0,
        name: '',
        displayName: null,
        description: null,
        subject: null,
        body: null,
        properties: {}
    };
    emit('close')
}

const syncAce = async () => {
    const seq = ++aceLoadSeq.value;
    await loadAce(aceLangSelected.value, aceThemeSelected.value);
    if (seq !== aceLoadSeq.value) return;
    aceLangApplied.value = aceLangSelected.value;
    aceThemeApplied.value = aceThemeSelected.value;
    aceReady.value = true;
};

onMounted(async () => {
    setFieldValue('name', newTemplate.value.name ?? '');
    await syncAce();
});

watch(name, (value) => {
    newTemplate.value.name = value ?? '';
});

watch([aceLangSelected, aceThemeSelected], () => {
    syncAce();
});

const onSubmit = handleSubmit(async (form) => {
    const ok = await confirm({
        title: '확인',
        message: `새로운 템플릿 "${form.name}" 을 생성하시겠습니까?`,
        okText: '예',
        cancelText: '아니오',
        color: 'primary',
    });
    if (!ok) return;

    overlay.value = true;
    try {
        const payload: TemplateRequest = {
            ...newTemplate.value,
            name: form.name,
        };
        const created = await createTemplate(payload);
        emit('updated', created);
        emit('complete', created);
        handleClose();
    } catch (e) {
        toast.error(resolveAxiosError(e));
    } finally {
        overlay.value = false;
    }
});



</script>
