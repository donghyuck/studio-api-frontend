<template>
  <v-breadcrumbs class="pa-0" :items="['응용프로그램', '게시판', '권한 관리']" density="compact" />
  <PageToolbar title="게시판 권한 관리" label="ACL 룰과 권한 액션을 확인/추가합니다." :divider="true" :closeable="false" :previous="true"
    @refresh="reload">
    <template #prepend>
      <v-tooltip text="포럼으로 돌아가기" location="top">
        <template #activator="{ props }">
          <v-btn v-bind="props" icon="mdi-arrow-left" variant="text" @click="goBack" />
        </template>
      </v-tooltip>
    </template>
    <template #append>
      <v-btn icon="mdi-shield-account" variant="tonal" @click="scrollToRules">테이블로 이동</v-btn>
    </template>
  </PageToolbar>
  <v-card class="mt-2 mb-2" rounded="lg">
    <v-toolbar density="compact" flat color="pink-darken-2">
      <v-toolbar-title class="text-subtitle-1">게시판 권한 생성</v-toolbar-title>
      <template v-slot:append>
        <v-switch v-model="advancedMode" label="고급 설정 보기" inset density="compact" hide-details color="primary" />
        <div class="text-caption ms-2 pr-2">
          고급 필드는 고급 옵션이 필요할 때만 입력하세요.
        </div>
      </template>
    </v-toolbar>
    <v-card-text>
      <v-alert v-if="aclError" type="error" variant="tonal" class="mb-4">
        {{ aclError }}
      </v-alert>
      <v-row>
        <v-col cols="12">
          <v-form @submit.prevent="submitRule">
            <v-row class="align-center">
              <v-col cols="12" md="4">
                <v-select v-model="form.subjectType" :items="subjectTypes" label="대상 타입*" density="compact" />
              </v-col>
              <v-col cols="12" md="4" v-if="isRoleSubject">
                <v-select v-if="isRoleSubject" v-model="form.role" :items="roleOptions" item-title="label"
                  item-value="role" label="역할 (ROLE)*" density="compact" />
              </v-col>
              <v-col v-else cols="12" md="4">
                <v-text-field v-if="selectedIdentifier === 'ID'" v-model="form.subjectId" :label="subjectIdLabel"
                  density="compact" type="number" persistent-hint :hint="subjectIdHint">
                  <template #append-inner>
                    <v-btn icon="mdi-magnify" variant="text" @click="openUserSearchDialog" />
                  </template>
                </v-text-field>
                <v-text-field v-if="selectedIdentifier === 'NAME'" v-model="form.subjectName" :label="subjectNameLabel"
                  density="compact" persistent-hint :hint="subjectNameHint">
                  <template #append-inner>
                    <v-btn icon="mdi-magnify" variant="text" @click="openUserSearchDialog" />
                  </template>
                </v-text-field>
              </v-col>
            </v-row>
            <v-row class="align-center">
              <v-col cols="12" md="4">
                <v-select v-model="form.action" :items="permissionActions" item-title="action" item-value="action"
                  label="권한 (설명 포함)*" density="compact">
                  <template v-slot:item="{ props: itemProps, item }">
                    <v-list-item v-bind="itemProps" :subtitle="item.raw.description"></v-list-item>
                  </template>
                </v-select>
              </v-col>
              <v-col cols="12" md="4">
                <v-select v-model="form.effect" :items="effectOptions" label="적용*" density="compact" />
              </v-col>
              <v-col cols="12" md="4">
                <v-select v-model="form.ownership" :items="ownershipOptions" label="Ownership*" density="compact"
                  persistent-hint :hint="ownershipHint" />
              </v-col>
            </v-row>
            <v-expand-transition>
              <v-row class="align-center" v-if="advancedMode">
                <v-col cols="12" md="4">
                  <v-select v-model="form.identifierType" :items="identifierOptions" label="식별자 타입" density="compact"
                    persistent-hint :hint="identifierHint" />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field v-model="form.priority" label="우선순위" density="compact" type="number" persistent-hint
                    :hint="priorityHint" />
                </v-col>
                <v-col cols="12" md="4">
                  <v-switch v-model="form.enabled" :label="form.enabled ? '활성화됨' : '비활성화됨'" inset density="compact"
                    color="primary" />
                </v-col>
                <v-col cols="12">
                  <v-text-field v-model="form.description" label="설명" density="compact" />
                </v-col>
              </v-row>
            </v-expand-transition>
          </v-form>
        </v-col>
      </v-row>
    </v-card-text>
    <v-divider class="border-opacity-100" />
    <v-card-actions>
      <v-btn color="pink-darken-2" text prepend-icon="mdi-help-circle" @click="matrixDialog = true" rounded="xl">
        권한 매트릭스 보기
      </v-btn>
      <v-tooltip location="bottom" text="현재 권한이 ALLOW/DENY 되어 있는지 여부를 확인 합니다.">
        <template #activator="{ props: tooltipProps }">
          <v-btn v-bind="tooltipProps" variant="text" color="pink" prepend-icon="mdi-eye-check" rounded="xl"
            :loading="simulationLoading" :disabled="simulationLoading || !canSimulate" @click="simulateRule"
            aria-label="권한 확인하기">
            권한 확인하기
          </v-btn>
        </template>
      </v-tooltip>
      <div class="flex-grow-1 ms-3">
        <v-alert v-if="simulationResult" :type="simulationResult.allowed ? 'success' : 'error'" variant="tonal"
          density="compact" class="mb-0">
          {{ simulationResult.action }} →
          {{ simulationResult.policyDecision }}
          <span v-if="simulationResult.aclDecision">({{ simulationResult.aclDecision }})</span>
          <div v-if="simulationResult.denyReason" class="text-caption text-secondary">
            {{ simulationResult.denyReason }}
          </div>
        </v-alert>
        <v-alert v-else-if="simulationError" type="error" variant="tonal" density="compact" class="mb-0">
          {{ simulationError }}
        </v-alert>
      </div>
      <v-spacer />
      <v-btn variant="text" color="grey" rounded="xl" @click="resetForm" width="100">
        초기화
      </v-btn>
      <v-btn v-if="editing" variant="tonal" prepend-icon="mdi-content-save-minus-outline" rounded="xl" color="red"
        width="100" @click="removeRule(editRuleId)">삭제</v-btn>
      <v-btn variant="outlined" :prepend-icon="editing ? 'mdi-content-save-outline' : 'mdi-content-save-plus-outline'"
        rounded="xl" color="primary" width="120" @click="submitRule">
        {{ editing ? "권한 수정" : "권한 추가" }}
      </v-btn>
    </v-card-actions>
  </v-card>
  <ForumRoleMatrixGuide v-model="matrixDialog" title="권한 메트릭스" />
  <v-row>
    <v-col cols="12" md="12">
      <PageToolbar title="게시판 ACL 권한" @refresh="reload" :closeable="false" :divider="false" :items="[
        { icon: 'mdi-refresh', event: 'refresh', }]"></PageToolbar>
      <GridContent ref="gridRef" :columns="columnDefs" :row-data="aclRules" :row-selection="'multiple'" :height="320" />
    </v-col>
  </v-row>
  <UserSearchDialog v-model="userSearchDialog" :title="userSearchTitle" :subtitle="userSearchSubtitle"
    :confirm-message="userSearchConfirmMessage" :select-btn-text="'선택하기'" :auto-close-on-success="true"
    :on-selected="applySelectedUser" @close="userSearchDialog = false" />
</template>

<script setup lang="ts">
import GridContent from "@/components/ag-grid/GridContent.vue";
import PageToolbar from "@/components/bars/PageToolbar.vue";
import { rolePermissionRows } from "@/data/studio/mgmt/forums";
import { useToast } from "@/plugins/toast";
import { useConfirm } from "@/plugins/confirm";
import { useForumAdminStore } from "@/stores/studio/mgmt/forum.admin.store";
import type {
  ForumAclRuleRequest,
  ForumAclRuleResponse,
  ForumAclSimulationRequest,
  ForumPermissionDecision,
  PermissionIdentifierType,
  PermissionOwnership,
} from "@/types/studio/forums";
import {
  IDENTIFIER_TYPES,
  OWNERSHIP_SCOPES,
  PERMISSION_ACTIONS,
  PERMISSION_EFFECTS,
  SUBJECT_TYPES,
} from "@/types/studio/forums";
import type { UserBasicDto } from "@/types/studio/user";
import { resolveAxiosError } from "@/utils/helpers";
import UserSearchDialog from "@/views/studio/mgmt/security/UserSearchDialog.vue";
import type { ColDef } from "ag-grid-community";
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import ForumRoleMatrixGuide from "./ForumRoleMatrixGuide.vue";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const confirm = useConfirm();
const store = useForumAdminStore();
const forumSlug = computed(() => String(route.params.forumSlug || ""));

const subjectTypes = SUBJECT_TYPES;
const identifierOptions = IDENTIFIER_TYPES;
const ownershipOptions = OWNERSHIP_SCOPES;
const effectOptions = PERMISSION_EFFECTS;
const permissionActionOptions = PERMISSION_ACTIONS;
const ownershipDescriptions: Record<PermissionOwnership, string> = {
  ANY: "작성자 여부와 관계없이 룰이 적용됩니다 (예: MODERATE, PIN_TOPIC).",
  OWNER_ONLY: "콘텐츠 작성자 본인에게만 룰이 적용됩니다 (예: 본인 글의 EDIT).",
  NON_OWNER_ONLY: "작성자가 아닌 사용자만 대상입니다 (예: 타인의 댓글 숨김).",
};
const identifierDescriptions: Record<PermissionIdentifierType, string> = {
  ID: "숫자 식별자(ID)를 사용하는 경우 사용자/대상 고유 ID를 입력합니다.",
  NAME: "NAME일 때 사용자 계정명 또는 그룹/이름을 기입합니다.",
};
const roleOptions = rolePermissionRows;
const ruleTable = ref<HTMLElement | null>(null);
const editing = ref(false);
const editRuleId = ref<number | null>(null);
const form = ref<ForumAclRuleRequest>({
  categoryId: null,
  role: "",
  subjectType: "ROLE",
  identifierType: "ID",
  subjectId: undefined,
  subjectName: "",
  action: "READ_BOARD",
  effect: "ALLOW",
  ownership: "ANY",
  priority: 100,
  enabled: true,
  description: "",
});
const advancedMode = ref(false);

const permissionActions = computed(() => store.permissionActions);
const aclRules = computed(() => store.aclRules);
const aclError = computed(() => store.aclError);
const ownershipHint = computed(() => ownershipDescriptions[form.value.ownership ?? "ANY"]);
const selectedIdentifier = computed<PermissionIdentifierType>(
  () => (form.value.identifierType ?? "ID") as PermissionIdentifierType
);
const identifierHint = computed(
  () => identifierDescriptions[selectedIdentifier.value]
);
const isRoleSubject = computed(() => form.value.subjectType === "ROLE");
const isUserSubject = computed(() => form.value.subjectType === "USER");
const subjectIdHint = computed(
  () => "사용자 ID는 숫자(예: 사용자 ID)로 입력하세요."
);
const subjectIdLabel = computed(() => (selectedIdentifier.value === "ID" ? "사용자 ID*" : "Subject ID"));
const subjectNameHint = computed(
  () => "아이디는 로그인 아이디를 의미합니다."
);
const subjectNameLabel = computed(() => (selectedIdentifier.value === "NAME" ? "아이디*" : "Subject Name"));
const priorityHint = computed(
  () => "우선순위 숫자가 작을수록 먼저 평가됩니다. 기본값 100."
);
const matrixDialog = ref(false);
const confirmAction = (message: string, color: string = "primary") =>
  confirm({
    title: "확인",
    message,
    okText: "예",
    cancelText: "아니오",
    color,
  });
const simulationLoading = ref(false);
const simulationResult = ref<ForumPermissionDecision | null>(null);
const simulationError = ref<string | null>(null);
const canSimulate = computed(() => !!form.value.action);

const simulateRule = async () => {
  if (!forumSlug.value) return;
  simulationError.value = null;
  simulationResult.value = null;
  simulationLoading.value = true;
  try {
    const payload: ForumAclSimulationRequest = {
      action: form.value.action,
      role: form.value.role ?? undefined,
      categoryId: form.value.categoryId ?? undefined,
      ownerId: form.value.subjectType === "USER" ? form.value.subjectId ?? undefined : undefined,
      locked: false,
      userId: selectedIdentifier.value === "ID" ? form.value.subjectId ?? undefined : undefined,
      username: selectedIdentifier.value === "NAME" ? form.value.subjectName ?? undefined : undefined,
    };
    const response = await store.simulateAclDecision(forumSlug.value, payload);
    simulationResult.value = response;
  } catch (err: any) {
    simulationError.value = resolveAxiosError(err);
    toast.error(simulationError.value);
  } finally {
    simulationLoading.value = false;
  }
};

watch(
  () => [
    form.value.action,
    form.value.role,
    form.value.subjectType,
    form.value.identifierType,
    form.value.subjectId,
    form.value.subjectName,
    form.value.ownership,
  ],
  () => {
    simulationResult.value = null;
    simulationError.value = null;
  }
);
const userSearchDialog = ref(false);
const openUserSearchDialog = () => {
  userSearchDialog.value = true;
};
const userSearchTitle = computed(() =>
  selectedIdentifier.value === "NAME" ? "사용자 검색(Username)" : "사용자 검색(ID)"
);
const userSearchSubtitle = computed(() =>
  selectedIdentifier.value === "NAME"
    ? "사용자를 검색하여 username 값을 채웁니다."
    : "사용자를 검색하여 ID 값을 채웁니다."
);
const userSearchConfirmMessage = computed(() => "해당 사용자 정보를 적용합니다.");

const applySelectedUser = (users: UserBasicDto[]) => {
  if (!users?.length) return;
  const user = users[0];
  if (selectedIdentifier.value === "ID") {
    form.value.subjectId = user.userId ?? undefined;
  } else {
    form.value.subjectName = user.username ?? user.name ?? "";
  }
  userSearchDialog.value = false;
};

const load = async () => {
  if (!forumSlug.value) return;
  await store.loadPermissionActions(forumSlug.value);
  await store.loadAclRules(forumSlug.value);
};

const reload = () => {
  load();
};

watch(forumSlug, () => {
  load();
});

onMounted(() => {
  load();
});

const submitRule = async () => {
  if (!forumSlug.value) return;
  try {
    if (editing.value && editRuleId.value) {
      const ok = await confirmAction("ACL 룰을 수정하시겠습니까?", "primary");
      if (!ok) return;
      await store.updateAclRule(forumSlug.value, editRuleId.value, form.value);
      toast.success("ACL 룰이 수정되었습니다.");
    } else {
      await store.createAclRule(forumSlug.value, form.value);
      toast.success("ACL 룰이 생성되었습니다.");
    }
    resetForm();
  } catch (error) {
    // error handled by store
  }
};

const prepareEdit = (rule: ForumAclRuleResponse) => {
  editing.value = true;
  editRuleId.value = rule.ruleId;
  form.value = {
    categoryId: rule.categoryId ?? undefined,
    role: rule.role ?? "",
    subjectType: rule.subjectType,
    identifierType: rule.identifierType,
    subjectId: rule.subjectId ?? undefined,
    subjectName: rule.subjectName ?? undefined,
    action: rule.action,
    effect: rule.effect,
    ownership: rule.ownership,
    priority: rule.priority,
    enabled: rule.enabled,
    description: rule.description ?? "",
  };
  ruleTable.value?.scrollIntoView({ behavior: "smooth" });
};

const resetForm = () => {
  editing.value = false;
  editRuleId.value = null;
  form.value = {
    categoryId: null,
    role: "",
    subjectType: "ROLE",
    identifierType: "ID",
    subjectId: undefined,
    subjectName: "",
    action: "READ_BOARD",
    effect: "ALLOW",
    ownership: "ANY",
    priority: 100,
    enabled: true,
    description: "",
  };
};

const removeRule = async (ruleId: number | null) => {
  if (!forumSlug.value) return;
  if (ruleId == null) return;
  const ok = await confirmAction("이 ACL 룰을 삭제하시겠습니까?", "error");
  if (!ok) return;
  await store.deleteAclRule(forumSlug.value, ruleId);
  toast.success("ACL 룰이 삭제되었습니다.");
};

const goBack = () => {
  router.push({ name: "ForumDetails", params: { forumSlug: forumSlug.value } });
};

const scrollToRules = () => {
  ruleTable.value?.scrollIntoView({ behavior: "smooth" });
};


/** GRID ACL */
const gridRef = ref<InstanceType<typeof GridContent> | null>(null);
const columnDefs: ColDef[] = [
  { field: "ruleId", headerName: "Rule ID", maxWidth: 90 },
  {
    field: "action", headerName: "권한", flex: 1, type: "hyperlinks", cellRendererParams: {
      mode: 'callback',
      onClick: (data: ForumAclRuleResponse, p: unknown, ev: Event) => {
        prepareEdit(data);
      },
    }
  },
  { field: "effect", headerName: "적용", maxWidth: 90 },
  { field: "ownership", headerName: "오너십", maxWidth: 90 },
  { field: "subjectType", headerName: "대상 타입", maxWidth: 90 },
  { field: "identifierType", headerName: "식별자 타입", maxWidth: 90 },
  { field: "subjectId", headerName: "대상 ID", maxWidth: 90 },
  { field: "subjectName", headerName: "대상 이름", maxWidth: 90 },
  { field: "role", headerName: "역할", flex: 1 },
  { field: "priority", headerName: "우선순위", maxWidth: 90, type: "number" },
  { field: "enabled", headerName: "활성화", maxWidth: 100 },
];


</script>

<style scoped></style>
