import { api } from "@/data/http";
import type {
  ChangeTopicStatusRequest,
  CreateCategoryRequest,
  CreateForumRequest,
  CreatePostRequest,
  CreateTopicRequest,
  ForumMemberResponse,
  ForumResponse,
  ForumAclRuleRequest,
  ForumAclRuleResponse,
  ForumAclSimulationRequest,
  ForumPermissionDecision,
  PermissionActionMetadata,
  PermissionAction,
  PinTopicRequest,
  LockTopicRequest,
  TopicResponse,
  UpdateForumSettingsRequest,
  UpdatePostRequest,
  UpsertForumMemberRequest,
  HidePostRequest,
} from "@/types/studio/forums";

export interface RolePermissionRow {
  role: string;
  label: string;
  basic: string;
  admin: string;
  note: string;
  grantedActions: RolePermissionAction[];
  adminActions?: RolePermissionAction[];
}

export const rolePermissionRows: RolePermissionRow[] = [
  {
    role: "OWNER",
    label: "OWNER (소유자)",
    basic:
      "READ_*, CREATE_TOPIC, REPLY_POST, EDIT_TOPIC, DELETE_TOPIC, EDIT_POST, DELETE_POST (자신 글에 한정) 권한이 제공됩니다.",
    admin:
      "관리자 전용 기능(HIDE_POST, MANAGE_BOARD, MODERATE 등)은 기본적으로 DENY되기 때문에, ACL에서 role=OWNER + 해당 action을 effect=ALLOW로 등록해야 OWNER에게도 쓸 수 있게 됩니다.",
    note: "ForumAccessResolver에서 OWNER는 ADMIN으로 매핑되어 기본 정책/ACL 평가 시 관리자 후보로 처리",
    grantedActions: [
      "READ_BOARD",
      "READ_TOPIC_LIST",
      "READ_TOPIC_CONTENT",
      "READ_ATTACHMENT",
      "CREATE_TOPIC",
      "EDIT_TOPIC",
      "DELETE_TOPIC",
      "REPLY_POST",
      "UPLOAD_ATTACHMENT",
      "EDIT_POST",
      "DELETE_POST",
    ],
    adminActions: [],
  },
  {
    role: "ADMIN",
    label: "ADMIN (관리자)",
    basic:
      "OWNER와 동일한 일반/수정 액션에 더해 관리자 전용 기능까지 모두 허용됩니다. OWNER와 달리 관리자 전용 액션(HIDE_POST, MODERATE, PIN_TOPIC, LOCK_TOPIC, MANAGE_BOARD 등)을 기본 정책에서 ALLOW하고, ACL 평가에서도 isAdmin/isOwner+admin role 조건을 통해 우선적으로 처리합니다.",
    admin: "관리자 전용 액션은 ACL에서 명시적으로 ALLOW할 수 있음",
    note: "ADMIN·OWNER·studio.features.forums.authz.admin-roles에 포함된 역할이 모두 동일하게 취급",
    grantedActions: [
      "READ_BOARD",
      "READ_TOPIC_LIST",
      "READ_TOPIC_CONTENT",
      "READ_ATTACHMENT",
      "CREATE_TOPIC",
      "EDIT_TOPIC",
      "DELETE_TOPIC",
      "REPLY_POST",
      "UPLOAD_ATTACHMENT",
      "EDIT_POST",
      "DELETE_POST",
      "HIDE_POST",
      "MODERATE",
      "PIN_TOPIC",
      "LOCK_TOPIC",
      "MANAGE_BOARD",
    ],
    adminActions: [
      "HIDE_POST",
      "MODERATE",
      "PIN_TOPIC",
      "LOCK_TOPIC",
      "MANAGE_BOARD",
    ],
  },
  {
    role: "MODERATOR",
    label: "MODERATOR (모더레이터)",
    basic:
      "기본적으로 일반 멤버와 똑같이 글 읽기/작성/답글이 가능하고, 자기 글에 한해서 수정·삭제도 됩니다.",
    admin:
      "반면 HIDE_POST, LOCK_TOPIC, MANAGE_BOARD처럼 진짜 관리자만 쓰는 기능은 기본적으로 막혀 있어서, 사용하려면 ACL에서 별도로 허용해줘야 합니다.",
    note: "ForumAccessResolver.isAdmin에서 관리자처럼 취급되므로 ACL만 추가하면 운영자 기능 수행 가능 (EDIT/DELETE는 토픽 상태/포럼 정책에 따라 제한될 수 있음)",
    grantedActions: [
      "READ_BOARD",
      "READ_TOPIC_LIST",
      "READ_TOPIC_CONTENT",
      "READ_ATTACHMENT",
      "CREATE_TOPIC",
      "REPLY_POST",
      "UPLOAD_ATTACHMENT",
      "EDIT_POST",
      "DELETE_POST",
    ],
    adminActions: [],
  },
  {
    role: "MEMBER",
    label: "MEMBER (일반 멤버)",
    basic:
      "일반적인 글 읽기/쓰기/댓글과 본인 글에 대한 수정/삭제는 허용되며, NOTICE/SECRET처럼 일부 게시판이나 LOCKED 토픽에서는 제한됩니다.",
    admin:
      "HIDE_POST 등은 기본 DENY → 부족한 기능은 ACL에서 별도 허용 필요합니다.",
    note: "일반 사용자, 추가 권한은 ForumAclRule로 부여",    grantedActions: [
      "READ_BOARD",
      "READ_TOPIC_LIST",
      "READ_TOPIC_CONTENT",
      "READ_ATTACHMENT",
      "CREATE_TOPIC",
      "REPLY_POST",
      "UPLOAD_ATTACHMENT",
      "EDIT_POST",
      "DELETE_POST",
    ],
  },
];
export const ROLE_PERMISSION_ACTIONS = [
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
  "HIDE_POST",
  "MODERATE",
  "PIN_TOPIC",
  "LOCK_TOPIC",
  "MANAGE_BOARD",
] as const;
export type RolePermissionAction = (typeof ROLE_PERMISSION_ACTIONS)[number];

export interface RolePermissionsByAction {
  role: string;
  label: string;
  actions: Record<RolePermissionAction, boolean>;
}

export const rolePermissionsMatrix: RolePermissionsByAction[] =
  rolePermissionRows.map((row) => ({
    role: row.role,
    label: row.label,
    actions: ROLE_PERMISSION_ACTIONS.reduce(
      (acc, action) => {
        acc[action] =
          row.grantedActions.includes(action) ||
          (!!row.adminActions?.length && row.adminActions.includes(action));
        return acc;
      },
      {} as Record<RolePermissionAction, boolean>,
    ),
  }));

export const ADMIN_BASE = "/api/mgmt/forums";

export const forumsAdminApi = {
  async getForum(forumSlug: string) {
    const res = await api.getWithMeta<ForumResponse>(
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}`,
    );
    return {
      data: res.data,
      etag: res.headers?.["etag"] as string | undefined,
    };
  },

  async listPermissionActions(forumSlug: string) {
    return api.get<PermissionActionMetadata[]>(
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/permissions/actions`,
    );
  },

  async listPermissionRules(
    forumSlug: string,
    params?: {
      categoryId?: number;
      action?: PermissionAction;
      role?: string;
      enabled?: boolean;
      page?: number;
      size?: number;
    },
  ) {
    return api.get<ForumAclRuleResponse[]>(
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/permissions`,
      { params },
    );
  },

  async createPermissionRule(forumSlug: string, payload: ForumAclRuleRequest) {
    return api.post<ForumAclRuleResponse>(
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/permissions`,
      payload,
    );
  },

  async updatePermissionRule(
    forumSlug: string,
    ruleId: number,
    payload: ForumAclRuleRequest,
  ) {
    return api.put<ForumAclRuleResponse>(
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/permissions/${ruleId}`,
      payload,
    );
  },

  async deletePermissionRule(forumSlug: string, ruleId: number) {
    return api.delete<{ ruleId: number; deleted: boolean }>(
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/permissions/${ruleId}`,
    );
  },

  async simulatePermission(
    forumSlug: string,
    payload: ForumAclSimulationRequest,
  ) {
    return api.get<ForumPermissionDecision>(
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/permissions/check`,
      { params: payload },
    );
  },

  async createForum(payload: CreateForumRequest) {
    const res = await api.postWithMeta<ForumResponse>(ADMIN_BASE, payload);
    return {
      data: res.data,
      etag: res.headers?.["etag"] as string | undefined,
    };
  },

  async updateForumSettings(
    forumSlug: string,
    payload: UpdateForumSettingsRequest,
    ifMatch: string,
  ) {
    const res = await api.putWithMeta<ForumResponse>(
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/settings`,
      payload,
      { headers: { "If-Match": ifMatch } },
    );
    return {
      data: res.data,
      etag: res.headers?.["etag"] as string | undefined,
    };
  },

  async createCategory(forumSlug: string, payload: CreateCategoryRequest) {
    return api.post<{ categoryId: number }>(
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/categories`,
      payload,
    );
  },

  async deleteCategory(forumSlug: string, categoryId: number) {
    return api.delete<{ categoryId: number; deleted: boolean }>(
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/categories/${categoryId}`,
    );
  },

  async createTopic(
    forumSlug: string,
    categoryId: number,
    payload: CreateTopicRequest,
  ) {
    return api.post<{ topicId: number }>(
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/categories/${categoryId}/topics`,
      payload,
    );
  },

  async createTopicWithoutCategory(
    forumSlug: string,
    payload: CreateTopicRequest,
  ) {
    return api.post<{ topicId: number }>(
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/topics`,
      payload,
    );
  },

  async changeTopicStatus(
    forumSlug: string,
    topicId: number,
    payload: ChangeTopicStatusRequest,
    ifMatch: string,
  ) {
    const res = await api.patchWithMeta<TopicResponse>(
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/topics/${topicId}/status`,
      payload,
      { headers: { "If-Match": ifMatch } },
    );
    return {
      data: res.data,
      etag: res.headers?.["etag"] as string | undefined,
    };
  },

  async pinTopic(
    forumSlug: string,
    topicId: number,
    payload: PinTopicRequest,
    ifMatch: string,
  ) {
    const res = await api.patchWithMeta<TopicResponse>(
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/topics/${topicId}/pin`,
      payload,
      { headers: { "If-Match": ifMatch } },
    );
    return {
      data: res.data,
      etag: res.headers?.["etag"] as string | undefined,
    };
  },

  async lockTopic(
    forumSlug: string,
    topicId: number,
    payload: LockTopicRequest,
    ifMatch: string,
  ) {
    const res = await api.patchWithMeta<TopicResponse>(
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/topics/${topicId}/lock`,
      payload,
      { headers: { "If-Match": ifMatch } },
    );
    return {
      data: res.data,
      etag: res.headers?.["etag"] as string | undefined,
    };
  },

  async deleteTopic(forumSlug: string, topicId: number, ifMatch: string) {
    return api.delete<{ topicId: number; deleted: boolean }>(
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/topics/${topicId}`,
      null,
      { headers: { "If-Match": ifMatch } },
    );
  },

  async createPost(
    forumSlug: string,
    topicId: number,
    payload: CreatePostRequest,
  ) {
    return api.post<{ postId: number }>(
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/topics/${topicId}/posts`,
      payload,
    );
  },

  async updatePost(
    forumSlug: string,
    topicId: number,
    postId: number,
    payload: UpdatePostRequest,
    ifMatch: string,
  ) {
    return api.patch<{ postId: number; updated: boolean }>(
      `${ADMIN_BASE}/${encodeURIComponent(
        forumSlug,
      )}/topics/${topicId}/posts/${postId}`,
      payload,
      { headers: { "If-Match": ifMatch } },
    );
  },

  async hidePost(
    forumSlug: string,
    topicId: number,
    postId: number,
    payload: HidePostRequest,
    ifMatch: string,
  ) {
    return api.patch<{ postId: number; hidden: boolean }>(
      `${ADMIN_BASE}/${encodeURIComponent(
        forumSlug,
      )}/topics/${topicId}/posts/${postId}/hide`,
      payload,
      { headers: { "If-Match": ifMatch } },
    );
  },

  async deletePost(
    forumSlug: string,
    topicId: number,
    postId: number,
    ifMatch: string,
  ) {
    return api.delete<{ postId: number; deleted: boolean }>(
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/topics/${topicId}/posts/${postId}`,
      null,
      { headers: { "If-Match": ifMatch } },
    );
  },

  async listMembers(
    forumSlug: string,
    params?: { page?: number; size?: number },
  ) {
    return api.get<ForumMemberResponse[]>(
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/members`,
      { params },
    );
  },

  async addMember(forumSlug: string, payload: UpsertForumMemberRequest) {
    return api.post<{ userId: number }>(
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/members`,
      payload,
    );
  },

  async updateMember(
    forumSlug: string,
    userId: number,
    payload: UpsertForumMemberRequest,
  ) {
    return api.patch<{ userId: number }>(
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/members/${userId}`,
      payload,
    );
  },

  async removeMember(forumSlug: string, userId: number) {
    return api.delete<{ userId: number; removed: boolean }>(
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/members/${userId}`,
    );
  },
};
