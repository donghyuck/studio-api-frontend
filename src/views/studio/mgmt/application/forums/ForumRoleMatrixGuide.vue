<template>
  <v-dialog v-model="dialog" width="auto" max-width="800px" :fullscreen="fullscreen">
    <v-card color="gray">
      <PageToolbar :title="title" @close="close" @fullscreen="toggleFullscreen" :closeable="true" :items="[
        { icon: fullscreen ? 'mdi-fullscreen-exit' : 'mdi-fullscreen', event: 'fullscreen', tooltip: fullscreenTooltip }
      ]" />
      <v-container fluid>
        <v-row no-gutters>
          <v-col>
            <v-card density="compact" outlined rounded>
              <v-card-title class="text-subtitle-2">역할별 권한 안내</v-card-title>
              <v-alert type="info" variant="tonal" density="compact" class="text-body-2" closable>
                역할에 따라 기본으로 제공되는 권한을 정리한 도움말입니다. 본인이 작성한 게시글과 댓글은 수정/삭제가 가능하며,
                HIDE_POST, MANAGE_BOARD, MODERATE, PIN_TOPIC, LOCK_TOPIC과 같은 관리자 전용 기능은 기본 권한에 포함되지 않기 때문에
                관리자 역할에서만 작동합니다. 필요할 경우 권한 설정에서 ACL로 별도 부여해 주세요.
              </v-alert>
              <v-card-actions class="pa-0">
                <v-btn class="ml-2" color="pink" prepend-icon="mdi-help-circle" text="역할에 대해 알아보기"
                  aria-label="역할에 대해 알아보기" variant="text" @click="show = !show" rounded="xl"></v-btn>
              </v-card-actions>
              <v-expand-transition>
                <div v-show="show">
                  <v-divider color="primary" class="border-opacity-100" />
                  <v-list lines="two" dense>
                    <v-list-item v-for="row in rolePermissionRows" :key="row.role" class="py-0">
                      <v-list-item-content>
                        <v-list-item-title>{{ row.label }}</v-list-item-title>
                        <v-list-item-subtitle>{{ row.basic }}</v-list-item-subtitle>
                      </v-list-item-content>
                    </v-list-item>
                  </v-list>
                </div>
              </v-expand-transition>
              <v-card-text class="pa-0">
                <perfect-scrollbar>
                  <v-simple-table dense class="matrix-table matrix-styled-table">
                    <thead>
                      <tr>
                        <th class="text-start text-subtitle-2" width="100">역할(ROLE)</th>
                        <th v-for="action in ROLE_PERMISSION_ACTIONS" :key="action" class="text-center text-subtitle-2">
                          {{ actionLabels[action] ?? action }} ({{ action }})
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in rolePermissionsMatrix" :key="row.role">
                        <td class="text-subtitle-2">{{ row.label }}</td>
                        <td v-for="action in ROLE_PERMISSION_ACTIONS" :key="`${row.role}-${action}`"
                          class="text-center">
                          <v-tooltip bottom>
                            <template #activator="{ props: activatorProps }">
                              <v-icon v-bind="activatorProps" size="20"
                                :color="row.actions[action] ? 'primary' : 'grey'">
                                {{ row.actions[action] ? "mdi-checkbox-marked-outline" : "mdi-checkbox-blank-outline" }}
                              </v-icon>
                            </template>
                            <span>{{ actionLabels[action] ?? action }}</span>
                          </v-tooltip>
                        </td>
                      </tr>
                    </tbody>
                  </v-simple-table>
                </perfect-scrollbar>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
        <v-row>
          <v-col>
            <v-card density="compact" outlined rounded>
              <v-card-title class="text-subtitle-2">게시판 유형별 권한 안내</v-card-title>
              <v-alert type="info" variant="tonal" density="compact" class="text-body-2" closable> 
                <v-row no-gutters>
                  <v-col v-for="audience in audienceInsights" :key="audience.label" cols="12" sm="6">
                    <div class="audience-label text-body-2">{{ audience.label }}</div>
                    <div class="audience-actions text-caption">{{ audience.actions }}</div>
                    <div class="audience-description text-body-2">{{ audience.detail }}</div>
                  </v-col>
                </v-row> 
              </v-alert>
              <v-card-item class="pt-2 pb-2 px-2">
                <v-select v-model="selectedForumType" :items="forumTypeSelectItems" label="포럼 유형 선택" block
                  density="compact" class="type-select" item-title="text" item-value="value"
                  :menu-props="{ maxHeight: '320px' }"
                  :hint="forumTypeNotes.find(n => n.type === selectedForumType)?.hint" persistent-hint />
              </v-card-item>
              <v-card-text class="pa-0">
                <perfect-scrollbar>
                  <v-simple-table dense class="matrix-table matrix-styled-table">
                    <thead>
                      <tr>
                        <th class="text-start text-subtitle-2 fixed-first-col" width="130">사용자 유형</th>
                        <th
                          v-for="action in ROLE_PERMISSION_ACTIONS"
                          :key="`type-${action}`"
                          class="text-center text-subtitle-2">
                          {{ actionLabels[action] ?? action }} ({{ action }})
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in audiencePermissionRows" :key="row.label">
                        <td class="text-subtitle-2 fixed-first-col">{{ row.label }}</td>
                        <td
                          v-for="action in ROLE_PERMISSION_ACTIONS"
                          :key="`${row.label}-${action}`"
                          class="text-center"
                        >
                          <v-icon :color="row.actions[action] ? 'primary' : 'grey'" size="16">
                            {{ row.actions[action] ? "mdi-checkbox-marked-outline" : "mdi-checkbox-blank-outline" }}
                          </v-icon>
                        </td>
                      </tr>
                    </tbody>
                  </v-simple-table>
                </perfect-scrollbar>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-card>
  </v-dialog>
</template>
<script setup lang="ts">
import PageToolbar from "@/components/bars/PageToolbar.vue";
import { computed, ref } from "vue";
import {
  rolePermissionsMatrix,
  ROLE_PERMISSION_ACTIONS,
  rolePermissionRows,
  type RolePermissionAction,
} from "@/data/studio/mgmt/forums";
import type { ForumType } from "@/types/studio/forums";
import { FORUM_TYPES, FORUM_TYPE_HINTS } from "@/types/studio/forums";
const props = defineProps<{
  modelValue: boolean;
  title?: string;
}>();

const show = ref(false);
const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();
const dialog = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit("update:modelValue", value),
});
const close = () => {
  emit("update:modelValue", false);
};
const fullscreen = ref(false);
const fullscreenTooltip = computed(() => (fullscreen.value ? "전체 화면 종료" : "전체 화면 보기"));
const toggleFullscreen = () => {
  fullscreen.value = !fullscreen.value;
};
const actionLabels: Record<string, string> = {
  READ_BOARD: "목록 보기",
  READ_TOPIC_LIST: "토픽 목록",
  READ_TOPIC_CONTENT: "본문 보기",
  READ_ATTACHMENT: "첨부파일 다운로드",
  CREATE_TOPIC: "글쓰기",
  REPLY_POST: "댓글 작성",
  UPLOAD_ATTACHMENT: "첨부파일 업로드/삭제",
  EDIT_TOPIC: "글 수정",
  DELETE_TOPIC: "글 삭제",
  EDIT_POST: "댓글 수정",
  DELETE_POST: "댓글 삭제",
  HIDE_POST: "댓글 숨김",
  MODERATE: "관리자 모드",
  PIN_TOPIC: "토픽 고정",
  LOCK_TOPIC: "토픽 잠금",
  MANAGE_BOARD: "게시판 관리",
};

const TYPE_ACTIONS: RolePermissionAction[] = [...ROLE_PERMISSION_ACTIONS];

const forumTypeFriendlyLabels: Record<ForumType, string> = {
  COMMON: "COMMON (일반형)",
  NOTICE: "NOTICE (공지형)",
  SECRET: "SECRET (비밀형)",
  ADMIN_ONLY: "ADMIN_ONLY (관리자 전용)",
};

const forumTypeNotes = FORUM_TYPES.map((type) => ({
  type,
  label: forumTypeFriendlyLabels[type],
  hint: FORUM_TYPE_HINTS[type],
}));

const TYPE_DEFAULT_ACTIONS: Record<ForumType, RolePermissionAction[]> = {
  COMMON: [
    "READ_BOARD",
    "READ_TOPIC_LIST",
    "READ_TOPIC_CONTENT",
    "READ_ATTACHMENT",
    "CREATE_TOPIC",
    "REPLY_POST",
    "UPLOAD_ATTACHMENT",
    "EDIT_TOPIC",
    "DELETE_TOPIC",
    "EDIT_POST",
    "DELETE_POST",
  ],
  NOTICE: ["READ_BOARD", "READ_TOPIC_LIST", "READ_TOPIC_CONTENT", "READ_ATTACHMENT"],
  SECRET: ["READ_BOARD", "READ_TOPIC_LIST"],
  ADMIN_ONLY: [],
};

const forumTypeActionRows = FORUM_TYPES.map((type) => ({
  type,
  actions: TYPE_ACTIONS.reduce((acc, action) => {
    acc[action] = TYPE_DEFAULT_ACTIONS[type]?.includes(action) ?? false;
    return acc;
  }, {} as Record<RolePermissionAction, boolean>),
}));

const selectedForumType = ref<ForumType>("COMMON");
const forumTypeSelectItems = FORUM_TYPES.map((type) => ({
  value: type,
  text: forumTypeFriendlyLabels[type],
}));
const selectedTypeHint = computed(() => FORUM_TYPE_HINTS[selectedForumType.value]);
const filteredTypeActionRows = computed(() =>
  forumTypeActionRows.filter((row) => row.type === selectedForumType.value),
);

type AudienceKey = "anonymous" | "member" | "admin";

const TYPE_AUDIENCE_ACTIONS: Record<ForumType, Record<AudienceKey, RolePermissionAction[]>> = {
  COMMON: {
    anonymous: ["READ_BOARD", "READ_TOPIC_LIST", "READ_TOPIC_CONTENT", "READ_ATTACHMENT"],
    member: [
      "READ_BOARD",
      "READ_TOPIC_LIST",
      "READ_TOPIC_CONTENT",
      "READ_ATTACHMENT",
      "CREATE_TOPIC",
      "REPLY_POST",
      "UPLOAD_ATTACHMENT",
      "EDIT_TOPIC",
      "DELETE_TOPIC",
      "EDIT_POST",
      "DELETE_POST",
    ],
    admin: [...ROLE_PERMISSION_ACTIONS],
  },
  NOTICE: {
    anonymous: ["READ_BOARD", "READ_TOPIC_LIST", "READ_TOPIC_CONTENT", "READ_ATTACHMENT"],
    member: ["READ_BOARD", "READ_TOPIC_LIST", "READ_TOPIC_CONTENT", "READ_ATTACHMENT"],
    admin: [...ROLE_PERMISSION_ACTIONS],
  },
  SECRET: {
    anonymous: [],
    member: ["READ_BOARD", "READ_TOPIC_LIST"],
    admin: [...ROLE_PERMISSION_ACTIONS],
  },
  ADMIN_ONLY: {
    anonymous: [],
    member: [],
    admin: [...ROLE_PERMISSION_ACTIONS],
  },
};

const audiencePermissionRows = computed(() => {
  const audienceDefaults = TYPE_AUDIENCE_ACTIONS[selectedForumType.value];
  return ([
    { label: "익명 사용자", key: "anonymous" as AudienceKey },
    { label: "인증된 일반 회원", key: "member" as AudienceKey },
    { label: "관리자/운영진", key: "admin" as AudienceKey },
  ] as const).map((entry) => ({
    label: entry.label,
    actions: ROLE_PERMISSION_ACTIONS.reduce((acc, action) => {
      acc[action] = audienceDefaults[entry.key].includes(action);
      return acc;
    }, {} as Record<RolePermissionAction, boolean>),
  }));
});

const audienceInsights = [
  {
    label: "익명 사용자",
    actions: "READ_BOARD, READ_TOPIC_LIST, READ_TOPIC_CONTENT, READ_ATTACHMENT",
    detail:
      "로그인하지 않은 사용자는 기본적으로 목록 및 본문 보기만 허용되며, 타입/ACL이 별도 제한하지 않으면 기본 읽기 흐름만 작동합니다.",
  },
  {
    label: "인증된 일반 회원",
    actions: "CREATE_TOPIC, REPLY_POST, 자신의 EDIT/DELETE",
    detail:
      "로그인한 멤버는 포럼 유형과 정책/ACL에 따라 글쓰기·댓글·자기 글 수정/삭제가 가능하며, 관리자 전용 기능은 ACL에서 추가로 허용해야 합니다.",
  },
];
</script>
<style scoped>
.matrix-help-text {
  font-size: 0.95rem;
  padding: 10px 14px;
  margin: 0 0 4px;
  color: rgba(255, 255, 255, 0.9);
  background-color: rgba(0, 0, 0, 0.12);
  border-radius: 6px;
}

.matrix-scroll {
  padding: 4px 8px;
  max-height: 420px;
  max-width: 95vw;
  overflow-x: auto;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.matrix-table {
  max-width: 100%;
  width: auto;
}

.matrix-styled-table th,
.matrix-styled-table td {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  padding: 6px 14px;
}

.matrix-styled-table th {
  background-color: rgba(0, 0, 0, 0.15);
  font-weight: 600;
  height: 56px;
}

.fixed-first-col {
  min-width: 125px;
  max-width: 125px;
}

.type-matrix-scroll .matrix-styled-table {
  min-width: 540px;
}

.type-action-cell {
  padding: 6px 10px;
}

.type-policy-panel,
.audience-policy-panel {
  width: 100%;
  background-color: rgba(255, 255, 255, 0.12);
  border-radius: 8px;
}

.type-note-col {
  padding: 10px 12px;
}

.type-note-label {
  font-weight: 600;
  margin-bottom: 4px;
}

.type-note-body {
  color: rgba(0, 0, 0, 0.75);
}

.audience-label {
  font-weight: 600;
  margin-bottom: 2px;
}

.audience-actions {
  color: rgba(0, 0, 0, 0.65);
  font-weight: 500;
}

.audience-description {
  margin-bottom: 8px;
}

.selected-type-note {
  padding: 4px 14px;
  font-size: 0.85rem;
  color: rgba(0, 0, 0, 0.7);
}

.type-action-selected {
  background-color: rgba(255, 255, 255, 0.08);
}
</style>
