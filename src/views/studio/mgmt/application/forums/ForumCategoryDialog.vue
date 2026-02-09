<template>
  <v-dialog v-model="open" width="720" transition="dialog-bottom-transition">
    <v-card>
      <PageToolbar
        title="카테고리 관리" 
        :items="[ 
        { icon: 'mdi-refresh', event: 'refresh', tooltip: '새로고침' }]"
        @refresh="refresh"
        @close="close"
        :closeable="true"
        :divider="true"
      /> 
      <v-card-text class="pa-3">
        <GridContent ref="gridRef" :columns="columnDefs" :row-data="categories" :row-selection="'multiple'"
          :height="320" /> 
      </v-card-text>      
      <v-divider />
      <v-card-text class="bg-grey-lighten-5">  
        <v-container>
          <v-row>
            <v-col cols="12">
              <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-3">
                {{ errorMessage }}
              </v-alert>
            </v-col> 
            <v-col cols="4" class="pb-0">
              <v-text-field v-model="name" label="카테고리 이름*" variant="outlined" density="compact" :disabled="saving" :error="!!nameError"
                :error-messages="nameError" @blur="validateField('name')" />
            </v-col>
            <v-col cols="5" class="pb-0">
              <v-text-field v-model="description" label="설명" variant="outlined" density="compact" :disabled="saving" />
            </v-col>
            <v-col cols="3" class="pb-0">
              <v-number-input v-model="position" :reverse="false" controlVariant="default" label="순서" :hideInput="false"
                hide-details variant="outlined" density="compact" :min="1" :inset="false" :disabled="saving" />
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn variant="tonal" color="grey" rounded="xl" width="100" @click="close" :disabled="saving">
          닫기
        </v-btn>
        <v-btn variant="outlined" prepend-icon="mdi-plus" rounded="xl" color="primary" width="120" :loading="saving"
          @click="create">
          추가
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import PageToolbar from "@/components/bars/PageToolbar.vue";
import GridContent from "@/components/ag-grid/GridContent.vue";
import { forumsAdminApi } from "@/data/studio/mgmt/forums";
import { forumsPublicApi } from "@/data/studio/public/forums";
import { resolveAxiosError } from "@/utils/helpers";
import { computed, ref, watch } from "vue";
import { useToast } from "@/plugins/toast";
import { useConfirm } from "@/plugins/confirm";
import { useForm, useField } from "vee-validate";
import * as yup from "yup";
import type { ColDef } from "ag-grid-community";
import ActionCellRenderer from '@/components/ag-grid/renderer/ActionCellRenderer.vue';

const props = defineProps<{ modelValue: boolean; forumSlug: string }>();
const emit = defineEmits<{ (e: "update:modelValue", v: boolean): void }>();

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit("update:modelValue", v),
});

const toast = useToast();
const confirm = useConfirm();
const loading = ref(false);
const saving = ref(false);
const errorMessage = ref<string | null>(null);

const categories = ref<Array<{ id: number; name: string; description?: string; position: number }>>([]);
const gridRef = ref<InstanceType<typeof GridContent> | null>(null);

const columnActions = [
  {
    label: '삭제',
    variant: 'tonal',
    prependIcon: 'mdi-delete',
    color: 'red',
    event: 'delete',
    tooltip: '카테고리를 삭제합니다.',
    visible: true,
  }
];
const onAction = async ({ action, row }: { action: string; row: any }) => {
  if (action !== "delete") return;
  const categoryId = Number(row?.id);
  if (!categoryId) {
    toast.error("삭제할 카테고리를 확인할 수 없습니다.");
    return;
  }
  const ok = await confirm({
    title: "확인",
    message: `'${row.name ?? ""}' 을 삭제할까요?`,
    okText: "예",
    cancelText: "아니오",
    color: "error",
  });
  if (!ok) return;
  saving.value = true;
  errorMessage.value = null;
  try {
    await forumsAdminApi.deleteCategory(props.forumSlug, categoryId);
    toast.success("카테고리를 삭제했습니다.");
    await load();
  } catch (e: any) {
    errorMessage.value = resolveAxiosError(e);
    toast.error(errorMessage.value);
  } finally {
    saving.value = false;
  }
};

const columnDefs: ColDef[] = [
  { field: "id", headerName: "ID", maxWidth: 90 },
  { field: "name", headerName: "이름", flex: 1 },
  { field: "description", headerName: "설명", flex: 2 },
  { field: "position", headerName: "순서", maxWidth: 90 },
  {
    colId: 'actions', headerName: '', filter: false, sortable: false, flex: 1.1, cellRenderer: ActionCellRenderer, cellRendererParams: {
      actions: columnActions, onAction
    }
  },
];


const schema = yup.object({
  name: yup.string().trim().required("필수 항목입니다.").max(100, "최대 100자까지 입력할 수 있습니다."),
});

const { validateField, resetForm } = useForm({
  validationSchema: schema,
  initialValues: { name: "" },
  validateOnMount: false,
  validateOnBlur: true,
  validateOnChange: false,
  validateOnInput: false,
} as any);

const { value: name, errorMessage: nameError } = useField<string>("name");
const description = ref("");
const position = ref(1);

const load = async () => {
  if (!props.forumSlug) return;
  loading.value = true;
  errorMessage.value = null;
  try {
    categories.value = await forumsPublicApi.listCategories(props.forumSlug);
    const max = Math.max(0, ...categories.value.map((c) => c.position ?? 0));
    position.value = max + 1;
  } catch (e: any) {
    errorMessage.value = resolveAxiosError(e);
  } finally {
    loading.value = false;
  }
};

const refresh = async () => {
  if (saving.value) return;
  await load();
};

const create = async () => {
  const valid = await validateField("name");
  if (!valid) return;
  saving.value = true;
  errorMessage.value = null;
  try {
    await forumsAdminApi.createCategory(props.forumSlug, {
      name: name.value?.trim() ?? "",
      description: description.value?.trim() || undefined,
      position: Number(position.value) || 1,
    });
    toast.success("카테고리를 추가했습니다.");
    resetForm({ values: { name: "" } });
    description.value = "";
    await load();
  } catch (e: any) {
    errorMessage.value = resolveAxiosError(e);
    toast.error(errorMessage.value);
  } finally {
    saving.value = false;
  }
};

const removeSelected = async () => {
  const rows = (gridRef.value?.selectedRows?.() ?? []) as Array<{
    id?: number;
    name?: string;
  }>;
  const ids = rows.map((row) => row.id).filter((id): id is number => !!id);
  if (ids.length === 0) {
    toast.error("삭제할 카테고리를 선택하세요.");
    return;
  }
  const ok = await confirm({
    title: "확인",
    message: `선택한 카테고리 ${ids.length}건을 삭제하시겠습니까?`,
    okText: "예",
    cancelText: "아니오",
    color: "error",
  });
  if (!ok) return;
  saving.value = true;
  errorMessage.value = null;
  try {
    for (const id of ids) {
      await forumsAdminApi.deleteCategory(props.forumSlug, id);
    }
    toast.success("카테고리를 삭제했습니다.");
    await load();
  } catch (e: any) {
    errorMessage.value = resolveAxiosError(e);
    toast.error(errorMessage.value);
  } finally {
    saving.value = false;
  }
};

const close = () => {
  if (saving.value) return;
  open.value = false;
};

watch(
  () => open.value,
  (v) => {
    if (v) {
      load();
    }
  }
);
</script>
