<template>
    <v-breadcrumbs class="pa-0" :items="['응용프로그램', '게시판', `${name}`]" density="compact"></v-breadcrumbs>
    <PageToolbar :title="pageTitle" label="게시판 설정을 변경합니다." @refresh="reload"
        @openCategories="openCategories" @openPermissions="openPermissions" @openAcl="openAcl" :closeable="false"
        :previous="true" :divider="true" :prepend-items="[]" :items="[
    { icon: 'mdi-format-list-bulleted', event: 'openCategories', tooltip: '카테고리 관리' },
    { icon: 'mdi-account-group', event: 'openPermissions', tooltip: '멤버 관리' , color: 'primary' },
    { icon: 'mdi-shield-account', event: 'openAcl', tooltip: '권한 관리' ,color:'pink-darken-2' },
    { icon: 'mdi-refresh', event: 'refresh', tooltip: '새로고침' }
        ]" />
    <v-card density="compact" class="mt-2" variant="elevated">
        <v-card-text class="pa-0">
            <v-container>
                <v-row>
                    <v-col cols="6" class="pb-0">
                        <v-text-field label="게시판 이름*" v-model="name"  clearable variant="outlined" density="compact"
                            :error="!!nameError" :error-messages="nameError" @blur="validateField('name')" />
                    </v-col>
                    <v-col cols="3" class="pb-0">
                        <v-text-field label="Slug" v-model="slug" readonly variant="outlined" density="compact"/>
                    </v-col>
                    <v-col cols="3" class="pb-0">
                        <v-select
                            v-model="viewType"
                            :items="viewTypeOptions"
                            label="보기 유형"
                            variant="outlined"
                            density="compact"
                            clearable
                        />
                    </v-col>
                    <v-col cols="6">
                        <v-select
                            v-model="type"
                            :items="forumTypeOptions"
                            label="게시판 유형"
                            variant="outlined"
                            density="compact"
                            persistent-hint
                            :hint="forumTypeHint" 
                           
                            :error="!!typeError"
                            :error-messages="typeError"
                        /> 
                    </v-col>
                    <v-col cols="12">
                        <v-textarea label="설명" rows="5" row-height="20"  v-model="description" variant="outlined" density="compact"
                            counter hint="게시판 설명을 입력하세요." :error="!!descriptionError"
                            :error-messages="descriptionError" @blur="validateField('description')" />
                    </v-col>
                    <v-col cols="12" v-if="errorMessage">
                        <v-alert type="error" variant="tonal" class="mb-0">
                            {{ errorMessage }}
                        </v-alert>
                    </v-col>
                    <v-col cols="12">
                        <PropertiesGrid :rowData="properties" @change="handlePropertiesChange" height="200px" />
                    </v-col>
                </v-row>
            </v-container>
        </v-card-text>
         <v-divider class="border-opacity-100"/>
        <v-card-actions>
            <v-spacer />
            <v-btn variant="tonal" color="grey" rounded="xl" width="100" @click="reload" :disabled="loading || saving">
                초기화
            </v-btn>
            <v-btn variant="outlined" prepend-icon="mdi-content-save" rounded="xl" color="primary" width="120"
                @click="onSubmit" :disabled="loading || saving">
                저장
            </v-btn>
        </v-card-actions>
    </v-card>
    <v-overlay v-model="overlay" contained class="align-center justify-center">
        <v-progress-circular color="primary" indeterminate size="64" />
    </v-overlay>
    <ForumCategoryDialog v-model="dialogs.categories" :forum-slug="forumSlug" />
    <ForumMembershipDialog v-model="dialogs.permissions" :forum-slug="forumSlug" />
</template>
<script setup lang="ts">
import PageToolbar from "@/components/bars/PageToolbar.vue";
import { forumsAdminApi } from "@/data/studio/mgmt/forums";
import { fromRowData, resolveAxiosError, toRowData } from "@/utils/helpers";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useConfirm } from "@/plugins/confirm";
import { useToast } from "@/plugins/toast";
import { useForm, useField } from "vee-validate";
import * as yup from "yup";
import ForumCategoryDialog from "./ForumCategoryDialog.vue";
import ForumMembershipDialog from "./ForumMembershipDialog.vue";
import PropertiesGrid from "@/views/studio/mgmt/PropertiesGrid.vue";
import type { Property } from "@/types/studio";
import { FORUM_TYPES, FORUM_TYPE_HINTS } from "@/types/studio/forums";
import type { ForumType } from "@/types/studio/forums";

const route = useRoute();
const router = useRouter();
const confirm = useConfirm();
const toast = useToast();

const overlay = ref(false);
const loading = ref(false);
const saving = ref(false);
const errorMessage = ref<string | null>(null);
const etag = ref<string | null>(null);
const dialogs = ref({ categories: false, permissions: false });

const forumSlug = computed(() => String(route.params.forumSlug || ""));

const schema = yup.object({
    name: yup.string().trim().required("필수 항목입니다.").max(100, "최대 100자까지 입력할 수 있습니다."),
    description: yup.string().trim().max(1000, "최대 1000자까지 입력할 수 있습니다.").optional(),
    viewType: yup.string().trim().max(50, "최대 50자까지 입력할 수 있습니다.").optional(),
    type: yup.string().trim().required("필수 항목입니다.").oneOf(FORUM_TYPES, "유효한 게시판 유형을 선택해 주세요."),
    properties: yup.object().default({}),
});

const { handleSubmit, validateField, resetForm, setFieldValue } = useForm({
    validationSchema: schema,
    initialValues: { name: "", description: "", viewType: "GENERAL", type: "COMMON", properties: {} },
    validateOnMount: false,
    validateOnBlur: true,
    validateOnChange: false,
    validateOnInput: false,
} as any);

const { value: name, errorMessage: nameError } = useField<string>("name");
const { value: description, errorMessage: descriptionError } = useField<string>("description");
const { value: viewType } = useField<string>("viewType");
const { value: type, errorMessage: typeError } = useField<ForumType>("type");
const slug = ref("");
const properties = ref<Property[]>([]);
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
const forumTypeHint = computed(() => FORUM_TYPE_HINTS[type.value ?? "COMMON"]);

const pageTitle = computed(() => (name.value ? `목록 : ${name.value}` : "게시판 설정"));

const loadForum = async () => {
    const slugValue = forumSlug.value;
    if (!slugValue) return;
    loading.value = true;
    errorMessage.value = null;
    try {
        const res = await forumsAdminApi.getForum(slugValue);
        const data = res.data;
        etag.value = res.etag ?? null;
        setFieldValue("name", data.name ?? "");
        setFieldValue("description", data.description ?? "");
        setFieldValue("viewType", data.viewType ?? "");
        setFieldValue("type", (data.type ?? "COMMON") as ForumType);
        slug.value = data.slug ?? slugValue;
        resetForm({
            values: {
                name: data.name ?? "",
                description: data.description ?? "",
                viewType: data.viewType ?? "GENERAL",
                type: (data.type ?? "COMMON") as ForumType,
                properties: data.properties ?? {},
            },
        });
        if (data.properties) {
            properties.value = toRowData(data.properties);
        } else {
            properties.value = [];
        }
    } catch (e: any) {
        errorMessage.value = resolveAxiosError(e);
    } finally {
        loading.value = false;
    }
};

const reload = () => {
    loadForum();
};

const openCategories = () => {
    dialogs.value.categories = true;
};

const openPermissions = () => {
    dialogs.value.permissions = true;
};

const openAcl = () => {
    const slug = forumSlug.value;
    if (!slug) return;
    router.push({ name: "ForumAcl", params: { forumSlug: slug } });
};

const handlePropertiesChange = (all: Property[]) => {
    properties.value = all;
};

const onSubmit = handleSubmit(async (form) => {
    const slugValue = forumSlug.value;
    if (!slugValue) return;
    if (!etag.value) {
        toast.error("최신 정보를 불러온 후 저장해 주세요.");
        return;
    }
    const ok = await confirm({
        title: "확인",
        message: "게시판 설정을 저장하시겠습니까?",
        okText: "예",
        cancelText: "아니오",
        color: "primary",
    });
    if (!ok) return;

    overlay.value = true;
    saving.value = true;
    errorMessage.value = null;
    try {
        const res = await forumsAdminApi.updateForumSettings(
            slugValue,
            {
                name: form.name.trim(),
                description: form.description?.trim() || undefined,
                viewType: form.viewType?.trim() || undefined,
                type: form.type as ForumType,
                properties: fromRowData(properties.value) as Record<string, string>,
            },
            etag.value
        );
        etag.value = res.etag ?? etag.value;
        toast.success("설정이 저장되었습니다.");
        await loadForum();
    } catch (e: any) {
        errorMessage.value = resolveAxiosError(e);
        toast.error(errorMessage.value);
    } finally {
        overlay.value = false;
        saving.value = false;
    }
});

watch(
    () => forumSlug.value,
    () => loadForum(),
    { immediate: true }
);
</script>
