<template>
    <v-dialog v-model="open" width="720">
        <v-card density="compact">
            <v-card-title class="d-flex align-center">
                새 문서 만들기
                <v-spacer />
                <v-btn icon="mdi-close" variant="text" @click="handleClose" />
            </v-card-title>
            <v-banner bg-color="blue" color="info" icon="mdi-information-outline" lines="one" text="이름은 주제를 입력하면 자동 생성됩니다." :stacked="false">
            </v-banner>
            <v-card-text>
                <v-row dense>
                    <v-col cols="3">
                        <v-number-input v-model.number="objectType" :reverse="false" controlVariant="default"
                            variant="outlined" label="객체 유형" :hideInput="false" hide-details density="compact" :min="0"
                            :inset="false"></v-number-input>
                    </v-col>
                    <v-col cols="3">
                        <v-number-input v-model.number="objectId" :reverse="false" controlVariant="default"
                            variant="outlined" label="객체 식별자" :hideInput="false" hide-details density="compact" :min="0"
                            :inset="false"></v-number-input>
                    </v-col>
                    <v-col cols="6" md="6">
                        <v-text-field v-model="name" label="이름*" density="compact" variant="outlined" readonly
                            :error="!!nameError" :error-messages="nameError" @blur="validateField('name')"
                            @input="nameTouched = true" />
                    </v-col>
                    <v-col cols="12" md="12">
                        <v-text-field v-model="title" label="주제*" density="compact" variant="outlined"
                            :error="!!titleError" :error-messages="titleError" @blur="validateField('title')" />
                    </v-col>
                    <v-col cols="12">
                        <v-textarea v-model="bodyText" label="내용" rows="8" density="compact" variant="outlined" counter
                            auto-grow />
                    </v-col>
                </v-row>
                <v-alert v-if="error" type="error" density="compact" class="mt-2">
                    {{ error }}
                </v-alert>
            </v-card-text>
            <v-card-actions>
                <v-spacer />
                <v-btn variant="tonal" color="grey" rounded="xl" @click="handleClose" width="100">
                    Cancel
                </v-btn>
                <v-btn variant="outlined" :loading="loading" prepend-icon="mdi-content-save" rounded="xl"
                    color="primary" width="100" @click="submit">
                    Save
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { documentApi } from "@/data/studio/mgmt/document";
import type { DocumentCreateRequest } from "@/types/studio/document";
import { useField, useForm } from "vee-validate";
import * as yup from "yup";
import { resolveAxiosError } from "@/utils/helpers";
import { useToast } from "@/plugins/toast";
import { useConfirm } from "@/plugins/confirm";

const toast = useToast();
const confirm = useConfirm();
const open = defineModel<boolean>({ default: false });

const objectType = ref<number>(0);
const objectId = ref<number>(0);
const bodyText = ref("# 새 문서\n");
const bodyType = ref<number>(1);
const loading = ref(false);
const error = ref<string | null>(null);
const nameTouched = ref(false);
const isAutoSettingName = ref(false);

const schema = yup.object({
    name: yup.string().strict(true).required("이름은 필수입니다. 제목을 입력하신 주제를 기반으로 자동 생성됩니다."),
    title: yup.string().strict(true).required("주제는 필수입니다."),
});

const { handleSubmit, resetForm, validateField } = useForm({
    validationSchema: schema,
    initialValues: { name: "", title: "" },
    validateOnMount: false,
    validateOnBlur: true,
    validateOnChange: false,
    validateOnInput: false,
} as any);

const { value: name, errorMessage: nameError } = useField<string>("name");
const { value: title, errorMessage: titleError } = useField<string>("title");

const emit = defineEmits<{
    (e: "close"): void;
    (e: "updated", payload: any): void;
    (e: "complete", payload: any): void;
}>();

const resetDialog = () => {
    objectType.value = 0;
    objectId.value = 0;
    bodyText.value = "# 새 문서\n";
    bodyType.value = 1;
    error.value = null;
    nameTouched.value = false;
    resetForm();
};

const handleClose = () => {
    resetDialog();
    open.value = false;
    emit("close");
};

watch(open, (value) => {
    if (!value) {
        resetDialog();
    }
});

const slugify = (input: string) => {
    const slug = input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return slug || "doc";
};

const shortId = () => {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        const bytes = new Uint8Array(2);
        crypto.getRandomValues(bytes);
        return Array.from(bytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
    }
    return Math.random().toString(16).slice(2, 6).padEnd(4, "0");
};

const generateName = (value: string) => `${slugify(value)}-${shortId()}`;

const autoSetName = (value: string) => {
    isAutoSettingName.value = true;
    name.value = value;
};

watch(title, (value) => {
    if (!value?.trim()) return;
    if (nameTouched.value) return;
    autoSetName(generateName(value));
});

watch(name, () => {
    if (isAutoSettingName.value) {
        isAutoSettingName.value = false;
        return;
    }
});

const submit = handleSubmit(async (form) => {

    const ok = await confirm({
        title: '확인',
        message: `새로운 문서 "${form.name}" 을 생성하시겠습니까?`,
        okText: '예',
        cancelText: '아니오',
        color: 'primary',
    });
    if (!ok) return;

    error.value = null;

    loading.value = true;
    try {
        const payload: DocumentCreateRequest = {
            objectType: objectType.value || 0,
            objectId: objectId.value || 0,
            name: form.name.trim(),
            title: form.title.trim(),
            bodyType: bodyType.value,
            bodyText: bodyText.value,
        };
        const created = await documentApi.createDocument(payload);
        emit("updated", created);
        emit("complete", created);
        handleClose();
    } catch (e: any) {
        toast.error(resolveAxiosError(e));
    } finally {
        loading.value = false;
    }
});
</script>
