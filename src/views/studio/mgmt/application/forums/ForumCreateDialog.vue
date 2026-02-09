<template>
    <v-dialog width="650" :fullscreen="false" :scrim="true" transition="dialog-bottom-transition" v-model="open">
        <v-card>
            <PageToolbar title="새 게시판" @close="handleClose" :closeable="true" :divider="true" />
            <v-card-text class="pa-0 bg-grey-lighten-5">
                <v-container>
                    <v-row>
                        <v-col cols="6" class="pb-0">
                            <v-text-field label="게시판 이름*" v-model="name" density="compact" clearable
                                :error="!!nameError" :error-messages="nameError" @blur="validateField('name')"
                                @update:model-value="onNameChanged" />
                        </v-col>
                        <v-col cols="6" class="pb-0">
                            <v-text-field label="Slug*" v-model="slug" density="compact" clearable
                                hint="소문자/숫자/하이픈(-)만 허용, 3~50자" persistent-hint :error="!!slugError"
                                :error-messages="slugError" @blur="onSlugBlur" />
                        </v-col>
                        <v-col cols="12" class="pb-0">
                            <v-textarea label="설명" rows="2" row-height="20" density="compact" v-model="description"
                                counter hint="게시판 설명을 입력하세요." :error="!!descriptionError"
                                :error-messages="descriptionError" @blur="validateField('description')" />
                        </v-col>
                        <v-col cols="6" class="pb-0">
                            <v-select
                                label="보기 유형"
                                v-model="viewType"
                                :items="viewTypeOptions"
                                density="compact"
                                clearable
                                @blur="validateField('viewType')"
                            />
                        </v-col>
                        <v-col cols="6" class="pb-0">
                            <v-select
                                label="게시판 유형"
                                v-model="type"
                                :items="forumTypeOptions"
                                density="compact"
                                :error="!!typeError"
                                :error-messages="typeError"
                                @blur="validateField('type')"
                            />
                            <p class="text-caption text-secondary mt-1 mb-0">{{ forumTypeHint }}</p>
                        </v-col>
                        <v-col cols="12">
                            <v-checkbox v-model="createDefaultCategories" density="compact"
                                label="기본 카테고리(공지/자유/질문/자료) 자동 생성" />
                        </v-col>
                        <v-col cols="12" v-if="errorMessage">
                            <v-alert type="error" variant="tonal" class="mb-0">
                                {{ errorMessage }}
                            </v-alert>
                        </v-col>
                    </v-row>
                </v-container>
            </v-card-text> 
            <v-divider />
            <v-card-actions>
                <v-spacer />
                <v-btn variant="tonal" color="grey" rounded="xl" @click="handleClose" width="100" :disabled="overlay">
                    취소
                </v-btn>
                <v-btn variant="outlined" prepend-icon="mdi-content-save" rounded="xl" color="primary" width="120"
                    :disabled="overlay" @click="onSubmit">
                    생성
                </v-btn>
            </v-card-actions>
        </v-card>
        <v-overlay v-model="overlay" contained class="align-center justify-center">
            <v-progress-circular color="primary" indeterminate size="64" />
        </v-overlay>
    </v-dialog>
</template>

<script setup lang="ts">
import PageToolbar from "@/components/bars/PageToolbar.vue";
import { useForumAdminStore } from "@/stores/studio/mgmt/forum.admin.store";
import { resolveAxiosError } from "@/utils/helpers";
import { computed, ref, watch } from "vue";
import { useConfirm } from "@/plugins/confirm";
import { useToast } from "@/plugins/toast";
import { useForm, useField } from "vee-validate";
import * as yup from "yup";
import { FORUM_TYPES, FORUM_TYPE_HINTS } from "@/types/studio/forums";
import type { ForumType } from "@/types/studio/forums";

type Emits = {
    (e: "update:modelValue", v: boolean): void;
    (e: "created", payload: { slug: string }): void;
};

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<Emits>();

const forumsStore = useForumAdminStore();
const confirm = useConfirm();
const toast = useToast();

const open = computed({
    get: () => props.modelValue,
    set: (v: boolean) => emit("update:modelValue", v),
});

const overlay = ref(false);
const errorMessage = ref<string | null>(null);
const userTouchedSlug = ref(false);

const schema = yup.object({
    name: yup.string().trim().required("필수 항목입니다.").max(100, "최대 100자까지 입력할 수 있습니다."),
    slug: yup
        .string()
        .trim()
        .required("필수 항목입니다.")
        .min(3, "3자 이상 입력해 주세요.")
        .max(50, "50자 이하로 입력해 주세요.")
        .matches(/^[a-z0-9-]+$/, "소문자/숫자/하이픈(-)만 사용할 수 있습니다.")
        .test("no-edge-dash", "하이픈(-)으로 시작/끝날 수 없습니다.", (v) => {
            if (!v) return true;
            return !v.startsWith("-") && !v.endsWith("-");
        })
        .test("no-double-dash", "하이픈(-)은 연속으로 사용할 수 없습니다.", (v) => {
            if (!v) return true;
            return !v.includes("--");
        }),
    description: yup.string().trim().max(1000, "최대 1000자까지 입력할 수 있습니다.").optional(),
    viewType: yup.string().trim().max(50, "최대 50자까지 입력할 수 있습니다.").optional(),
    type: yup.string().trim().required("필수 항목입니다.").oneOf(FORUM_TYPES, "유효한 게시판 유형을 선택해 주세요."),
    createDefaultCategories: yup.boolean().required(),
});

const { handleSubmit, validateField, resetForm, setFieldValue } = useForm({
    validationSchema: schema,
    initialValues: {
        name: "",
        slug: "",
        description: "",
        viewType: "GENERAL",
        type: "COMMON",
        createDefaultCategories: true,
    },
    validateOnMount: false,
    validateOnBlur: true,
    validateOnChange: false,
    validateOnInput: false,
} as any);

const { value: name, errorMessage: nameError } = useField<string>("name");
const { value: slug, errorMessage: slugError } = useField<string>("slug");
const { value: description, errorMessage: descriptionError } = useField<string>("description");
const { value: viewType } = useField<string>("viewType");
const { value: type, errorMessage: typeError } = useField<ForumType>("type");
const { value: createDefaultCategories } = useField<boolean>("createDefaultCategories");
const viewTypeOptions = [
    { title: "일반형", value: "GENERAL" },
    { title: "갤러리형", value: "GALLERY" },
    { title: "동영상형", value: "VIDEO" },
    { title: "자료실형", value: "LIBRARY" },
    { title: "공지형", value: "NOTICE" },
];
const forumTypeOptions = [
    { title: "COMMON (일반형)", value: "COMMON" as ForumType },
    { title: "NOTICE (공지형)", value: "NOTICE" as ForumType },
    { title: "SECRET (비밀형)", value: "SECRET" as ForumType },
    { title: "ADMIN_ONLY (관리자 전용)", value: "ADMIN_ONLY" as ForumType },
];
const forumTypeHints = FORUM_TYPE_HINTS;
const forumTypeHint = computed(() => forumTypeHints[type.value ?? "COMMON"]);

watch(
    () => open.value,
    (v) => {
        if (v) {
            resetDialog();
        }
    }
);

const resetDialog = () => {
    resetForm({
        values: {
            name: "",
            slug: "",
            description: "",
            viewType: "GENERAL",
            type: "COMMON",
            createDefaultCategories: true,
        },
    });
    errorMessage.value = null;
    overlay.value = false;
    userTouchedSlug.value = false;
};

const handleClose = () => {
    if (overlay.value) return;
    resetDialog();
    open.value = false;
    emit("created", { slug: "" });
};

const slugify = (input: string) => {
    return (input ?? "")
        .trim()
        .toLowerCase()
        .replace(/[_\s]+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
};

const onNameChanged = () => {
    if (!userTouchedSlug.value) {
        setFieldValue("slug", slugify(name.value ?? ""));
        validateField("slug");
    }
};

const onSlugBlur = () => {
    userTouchedSlug.value = true;
    validateField("slug");
};

const onSubmit = handleSubmit(async (form) => {
    const ok = await confirm({
        title: "확인",
        message: `게시판 "${form.name}" 을 생성하시겠습니까?`,
        okText: "예",
        cancelText: "아니오",
        color: "primary",
    });
    if (!ok) return;

    overlay.value = true;
    errorMessage.value = null;
    try {
        await forumsStore.createForum({
            slug: form.slug.trim(),
            name: form.name.trim(),
            description: form.description?.trim() || undefined,
            viewType: form.viewType?.trim() || undefined,
            type: form.type,
        });

        if (form.createDefaultCategories) {
            const defaults = [
                { name: "공지", description: "공지 사항", position: 1 },
                { name: "자유", description: "자유 게시판", position: 2 },
                { name: "질문", description: "질문/답변", position: 3 },
                { name: "자료", description: "자료 공유", position: 4 },
            ];
            for (const item of defaults) {
                await forumsStore.createCategory(form.slug.trim(), item);
            }
        }

        emit("created", { slug: form.slug.trim() });
        open.value = false;
    } catch (e: any) {
        const message = resolveAxiosError(e);
        errorMessage.value = message;
        toast.error(message);
    } finally {
        overlay.value = false;
    }
});
</script>
