<template>
  <v-dialog v-model="open" width="760" transition="dialog-bottom-transition">
    <v-card>
      <PageToolbar title="멤버 관리" :items="[
        { icon: 'mdi-refresh', event: 'refresh', tooltip: '새로고침' },
        { icon: 'mdi-help-circle', event: 'openRoleHelp', tooltip: '역할 안내' }
      ]" @refresh="refresh" @openRoleHelp="openRoleHelp" @close="close"
        :closeable="true" :divider="true" />
      <v-card-text class="pa-0 bg-grey-lighten-5">
        <v-container>
          <v-row>
            <v-col v-if="errorMessage" cols="12" class="pb-0">
              <v-alert type="error" variant="tonal" class="mb-3">
                {{ errorMessage }}
              </v-alert>
            </v-col>
            <v-col cols="12" class="pb-0">
              <GridContent ref="gridRef" :columns="columnDefs" :row-data="members" :row-selection="'multiple'"
                :height="320" />
            </v-col>
            <v-col v-if="hasMore" cols="12" class="pt-0 d-flex justify-end">
              <v-btn size="small" variant="text" color="primary" :loading="loadingMore" :disabled="loading || saving"
                @click="loadMore">
                더 보기
              </v-btn>
            </v-col>
            <template v-if="showRoleEditor">
              <v-col cols="12">
                <v-alert v-if="roleDescription" type="info" variant="tonal" density="compact" class="mt-1 text-body-2">
                  {{ roleDescription }}
                </v-alert>
              </v-col>
              <v-col cols="4" class="pb-0">
                <v-text-field
                  :model-value="selectedUserName"
                  label="사용자"
                  density="compact"
                  :disabled="saving"
                  :error="!!userIdError"
                  readonly
                  variant="outlined"
                  :error-messages="userIdError"
                  placeholder="사용자를 선택하세요"
                >
                  <template #prepend-inner>
                    <v-avatar size="20" color="grey-darken-3" :image="selectedUserAvatar" />
                  </template>
                </v-text-field>
              </v-col>
              <v-col cols="4" class="pb-0">
                <v-select v-model="role" :items="roles" label="역할" density="compact" :disabled="saving"
                  variant="outlined">
                  <template v-slot:append>
                    <v-btn icon="mdi-content-save" variant="tonal" color="primary" :disabled="!canSave"
                      aria-label="권한 저장" @click="save" />
                  </template>
                </v-select>
              </v-col>
            </template>
          </v-row>
        </v-container>
      </v-card-text>
    <v-card-actions>
      <v-btn variant="outlined" prepend-icon="mdi-account-minus" rounded="xl" color="error" :disabled="!canDelete"
        @click="removeSelected">
        선택 멤버 삭제
        </v-btn>
        <v-select v-model="searchRole" :items="roles" label="멤버에 부여할 역할" density="compact" variant="outlined"
          hide-details :disabled="saving" style="max-width: 170px" />
        <v-btn variant="outlined" prepend-icon="mdi-account-plus" rounded="xl" color="primary" aria-label="멤버 검색 후 추가"
          width="120">
          멤버 추가
          <UserSearchDialog activator="parent" v-model="dialog.user.visible" :title="addMemberTitle"
            :subtitle="addMemberSubtitle" :confirm-message="addMemberConfirmMessage" :select-btn-text="'추가'"
            :auto-close-on-success="false" :on-selected="addMembersFromSearch" @close="dialog.user.visible = false" />
        </v-btn>

        <v-spacer />
        <v-btn variant="tonal" color="grey" rounded="xl" width="100" @click="close" :disabled="saving">
          취소
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  <v-dialog v-model="roleHelpDialog" max-width="800">
    <v-card>
      <PageToolbar title="역할 안내" :closeable="true" @close="closeRoleHelp" :divider="true" />
      <v-card-text class="pa-2">
        <v-table density="compact" fixed-header height="500px" class="border-opacity-100 bg-transparent" striped="even">
          <thead>
            <tr>
              <th class="text-start">역할</th>
              <th class="text-start">기본 정책 허용 액션</th>
              <th class="text-start">관리자/ACL 허용 액션</th>
              <!-- <th class="text-start">비고</th> -->
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rolePermissionRows" :key="row.role">
              <td>{{ row.label }}</td>
              <td>{{ row.basic }}</td>
              <td>{{ row.admin }}</td>
              <!-- <td>{{ row.note }}</td> -->
            </tr>
          </tbody>
        </v-table>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import PageToolbar from "@/components/bars/PageToolbar.vue";
import GridContent from "@/components/ag-grid/GridContent.vue";
import UserSearchDialog from "@/views/studio/mgmt/security/UserSearchDialog.vue";
import { forumsAdminApi, rolePermissionRows } from "@/data/studio/mgmt/forums";
import { getProfileImageUrl } from "@/data/studio/public/user";
import type { ForumMemberResponse, ForumMemberRole } from "@/types/studio/forums";
import type { UserBasicDto, UserDto } from "@/types/studio/user";
import { resolveAxiosError } from "@/utils/helpers";
import { computed, ref, watch, watchEffect } from "vue";
import { useConfirm } from "@/plugins/confirm";
import { useToast } from "@/plugins/toast";
import { useForm, useField } from "vee-validate";
import * as yup from "yup";
import type { ColDef } from "ag-grid-community";
import RemoteMgmtUserCellRenderer from '@/components/ag-grid/renderer/RemoteMgmtUserCellRenderer.vue';
import NO_AVATAR from "@/assets/images/users/no-avatar.png";
import { useUserBasicStore } from "@/stores/studio/mgmt/user.basic.store";

const props = defineProps<{ modelValue: boolean; forumSlug: string }>();
const emit = defineEmits<{ (e: "update:modelValue", v: boolean): void }>();

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit("update:modelValue", v),
});

const toast = useToast();
const confirm = useConfirm();
const userStore = useUserBasicStore();
const loading = ref(false);
const loadingMore = ref(false);
const saving = ref(false);
const errorMessage = ref<string | null>(null);

const members = ref<ForumMemberResponse[]>([]);
const gridRef = ref<InstanceType<typeof GridContent> | null>(null);
const columnDefs: ColDef[] = [
  {
    headerName: "",
    field: "select",
    maxWidth: 65,
    pinned: "left",
    sortable: false,
    filter: false,
    resizable: false,
    checkboxSelection: true,
    headerCheckboxSelection: false,
  },
  { field: "userId", headerName: "멤버", flex: 1, cellRenderer: RemoteMgmtUserCellRenderer },
  {
    field: "role",
    headerName: "역할",
    filter: false,
    sortable: true,
    type: "hyperlinks",
    flex: 2,
    cellRendererParams: {
      mode: "callback",
      icon: "mdi-account-tag",
      iconPosition: "left",
      onClick: (data: ForumMemberResponse) => {
        selectMember(data);
      },
    },
  },
  { field: "createdById", headerName: "생성자", maxWidth: 100, cellRenderer: RemoteMgmtUserCellRenderer },
  { field: "createdAt", headerName: "생성일", flex: 1, type: 'datetime' },
];
const roles: ForumMemberRole[] = ["OWNER", "ADMIN", "MODERATOR", "MEMBER"];
const page = ref(0);
const pageSize = 20;
const hasMore = ref(false);

const schema = yup.object({
  userId: yup
    .number()
    .typeError("사용자 ID는 숫자여야 합니다.")
    .required("필수 항목입니다."),
});

const { validateField, resetForm, setFieldValue } = useForm({
  validationSchema: schema,
  initialValues: { userId: "" },
  validateOnMount: false,
  validateOnBlur: true,
  validateOnChange: false,
  validateOnInput: false,
} as any);

const { value: userId, errorMessage: userIdError } = useField<string>("userId");
const role = ref<ForumMemberRole>("MEMBER");
const searchRole = ref<ForumMemberRole>("MEMBER");
const roleDescriptions: Record<string, string> = {
  OWNER: "게시판 소유자입니다. 모든 설정과 멤버 관리 권한을 가집니다.",
  ADMIN: "관리자입니다. 게시판 설정과 멤버 관리 권한을 가집니다.",
  MODERATOR: "모더레이터입니다. 게시글/댓글 관리 권한을 가집니다.",
  MEMBER: "일반 멤버입니다. 기본 읽기/쓰기 권한을 가집니다.",
};
const roleDescription = computed(() => roleDescriptions[role.value] ?? "");
const canSave = computed(() => !saving.value && !!userId.value);
const showRoleEditor = computed(() => !!userId.value);
const selectedMembers = computed(() => gridRef.value?.selectedRows?.() ?? []);
const canDelete = computed(() => !saving.value && selectedMembers.value.length > 0);
const dialog = ref({ user: { visible: false } });
const addMemberTitle = computed(() => `멤버 추가 (${searchRole.value})`);
const addMemberSubtitle = computed(
  () => `선택된 사용자는 ${searchRole.value} 권한으로 추가됩니다.`
);
const addMemberConfirmMessage = computed(
  () => `선택된 사용자를 ${searchRole.value} 권한으로 추가하시겠습니까? 이 작업은 되돌릴 수 없습니다.`
);
const selectedUser = ref<UserBasicDto | null>(null);
const selectedUserId = computed(() => Number(userId.value));
const selectedUserName = computed(() => {
  const name = selectedUser.value?.username ?? "";
  if (name.trim().length > 0) return name;
  const id = selectedUserId.value;
  if (!Number.isFinite(id) || id <= 0) return "";
  return `${id}`;
});
const selectedUserAvatar = computed(() => {
  const username = selectedUser.value?.username?.trim();
  if (username) return getProfileImageUrl(username);
  const id = selectedUserId.value;
  if (Number.isFinite(id) && id > 0) return getProfileImageUrl(id);
  return NO_AVATAR;
});

watchEffect(async () => {
  const id = selectedUserId.value;
  if (!Number.isFinite(id) || id <= 0) {
    selectedUser.value = null;
    return;
  }
  try {
    selectedUser.value = await userStore.fetch(id);
  } catch {
    selectedUser.value = null;
  }
});

const addMembersFromSearch = async (users: UserDto[]) => {
  const userIds = Array.from(
    new Set(
      users
        .map((u) => u?.userId)
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    )
  );
  if (userIds.length === 0) return;
  saving.value = true;
  errorMessage.value = null;
  try {
    await Promise.all(
      userIds.map(async (id) => {
        const existing = members.value.find((item) => item.userId === id);
        const payload = { userId: id, role: searchRole.value };
        if (existing) {
          return forumsAdminApi.updateMember(props.forumSlug, id, payload);
        }
        return forumsAdminApi.addMember(props.forumSlug, payload);
      })
    );
    toast.success(`총 ${userIds.length}명의 회원을 ${searchRole.value} 권한으로 추가했습니다.`);
    await load();
  } catch (e: any) {
    errorMessage.value = resolveAxiosError(e);
    toast.error(errorMessage.value);
  } finally {
    saving.value = false;
  }
};

const load = async () => {
  if (!props.forumSlug) return;
  page.value = 0;
  loading.value = true;
  errorMessage.value = null;
  hasMore.value = false;
  members.value = [];
  try {
    const data = await forumsAdminApi.listMembers(props.forumSlug, {
      page: page.value,
      size: pageSize,
    });
    members.value = data;
    hasMore.value = data.length === pageSize;
  } catch (e: any) {
    errorMessage.value = resolveAxiosError(e);
  } finally {
    loading.value = false;
  }
};

const refresh = async () => {
  if (saving.value) return;
  resetSelectedUser();
  await load();
};

const loadMore = async () => {
  if (!props.forumSlug || loadingMore.value || !hasMore.value) return;
  loadingMore.value = true;
  errorMessage.value = null;
  try {
    const nextPage = page.value + 1;
    const data = await forumsAdminApi.listMembers(props.forumSlug, {
      page: nextPage,
      size: pageSize,
    });
    members.value = members.value.concat(data);
    page.value = nextPage;
    hasMore.value = data.length === pageSize;
  } catch (e: any) {
    errorMessage.value = resolveAxiosError(e);
  } finally {
    loadingMore.value = false;
  }
};

const save = async () => {
  const valid = await validateField("userId");
  if (!valid) return;
  saving.value = true;
  errorMessage.value = null;
  try {
    const payload = {
      userId: Number(userId.value),
      role: role.value,
    };
    const existing = members.value.find((item) => item.userId === payload.userId);
    if (!existing) {
      toast.error("리스트에서 멤버를 선택해 권한을 변경하세요.");
      return;
    }
    await forumsAdminApi.updateMember(props.forumSlug, payload.userId, payload);
    toast.success("멤버 권한을 수정했습니다.");
    resetForm({ values: { userId: "" } });
    role.value = "MEMBER";
    await load();
  } catch (e: any) {
    errorMessage.value = resolveAxiosError(e);
    toast.error(errorMessage.value);
  } finally {
    saving.value = false;
  }
};

const formatSelectedSummary = (items: ForumMemberResponse[]) => {
  if (items.length === 0) return "";
  const names = items.slice(0, 3).map((item) => String(item.userId));
  const suffix = items.length > 3 ? ` 외 ${items.length - 3}명` : "";
  return `${names.join(", ")}${suffix}`;
};

const removeSelected = async () => {
  const rows = selectedMembers.value as ForumMemberResponse[];
  if (rows.length === 0) {
    toast.error("삭제할 멤버를 선택하세요.");
    return;
  }
  const ok = await confirm({
    title: "확인",
    message: `선택한 멤버 ${formatSelectedSummary(rows)} 포함 총 ${rows.length}명을 삭제하시겠습니까?`,
    okText: "예",
    cancelText: "아니오",
    color: "error",
  });
  if (!ok) return;
  saving.value = true;
  errorMessage.value = null;
  try {
    await Promise.all(
      rows.map((item) => forumsAdminApi.removeMember(props.forumSlug, item.userId))
    );
    toast.success("선택한 멤버를 제거했습니다.");
    await load();
  } catch (e: any) {
    errorMessage.value = resolveAxiosError(e);
    toast.error(errorMessage.value);
  } finally {
    saving.value = false;
  }
};

const resetSelectedUser = () => {
  resetForm({ values: { userId: "" } });
  role.value = "MEMBER";
  selectedUser.value = null;
};

const selectMember = (item: ForumMemberResponse) => {
  setFieldValue("userId", String(item.userId));
  role.value = item.role;
};

const roleHelpDialog = ref(false);
const openRoleHelp = () => {
  roleHelpDialog.value = true;
};
const closeRoleHelp = () => {
  roleHelpDialog.value = false;
};
const close = () => {
  if (saving.value) return;
  open.value = false;
  resetSelectedUser();
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

<style scoped>
</style>
