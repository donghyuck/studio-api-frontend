import type { PageParams } from "@/types/studio/api-common";

// ---------- Forum ----------
export const FORUM_TYPES = ["COMMON", "NOTICE", "SECRET", "ADMIN_ONLY"] as const;
export type ForumType = (typeof FORUM_TYPES)[number];
export const FORUM_TYPE_HINTS: Record<ForumType, string> = {
  COMMON: "공개 포럼으로 “읽기”는 누구나, “작성/답글”은 로그인한 일반 회원도 가능. 별도 ACL 없이 일반 권한 흐름으로 충분합니다.",
  NOTICE: "공지 포럼으로 읽기는 누구나, 쓰기/답글/수정은 관리자/운영진만 허용되도록 ACL에서 제한해야 합니다.",
  SECRET: "비밀 포럼으로 글 본문은 작성자와 관리자만 볼 수 있으며, 목록 노출 여부는 별도 설정으로 제어합니다.",
  ADMIN_ONLY: "관리자 전용 포럼으로 관리자/운영진만 목록과 본문에 접근하도록 ACL에서 모든 주요 액션을 제한합니다.",
};

export interface CreateForumRequest {
  slug: string;
  name: string;
  description?: string;
  viewType?: string;
  type?: ForumType;
  properties?: Record<string, string>;
}

export interface UpdateForumSettingsRequest {
  name?: string;
  description?: string;
  viewType?: string;
  type?: ForumType;
  properties?: Record<string, string>;
}

export interface ForumResponse {
  id: number;
  slug: string;
  name: string;
  description?: string;
  type?: ForumType;
  viewType?: string;
  properties?: Record<string, string>;
  updatedAt?: string; // OffsetDateTime -> ISO string
}

export interface ForumSummaryResponse {
  slug: string;
  name: string;
  type?: ForumType;
  viewType?: string;
  updatedAt?: string;
  topicCount?: number;
  postCount?: number;
  lastActivityAt?: string;
  lastActivityById?: number;
  lastActivityBy?: string;
  lastActivityType?: string;
  lastActivityId?: number;
}

export interface ListForumsParams extends PageParams {
  q?: string;
  in?: string; // CSV
}

// ---------- Category ----------
export interface CreateCategoryRequest {
  name: string;
  description?: string;
  position: number; // int
}

export interface CategoryResponse {
  id: number;
  name: string;
  description?: string;
  position: number;
}

// ---------- Topic ----------
export type TopicStatus = string; // "OPEN" | "CLOSED" 등 (서버 enum에 맞춰 좁혀도 됨)

export interface CreateTopicRequest {
  // 서버 DTO에는 categoryId가 있지만, 컨트롤러에서 path categoryId로 덮어씀
  // 따라서 클라이언트에서는 생략 가능(옵션).
  categoryId?: number;
  title: string;
  tags?: string[];
}

export interface UpdateTopicRequest {
  title?: string;
  tags?: string[];
}

export interface ChangeTopicStatusRequest {
  status: TopicStatus;
}

export interface PinTopicRequest {
  pinned: boolean;
}

export interface LockTopicRequest {
  locked: boolean;
}

export interface TopicResponse {
  id: number;
  categoryId: number | null;
  title: string;
  tags?: string[];
  status?: TopicStatus;
  updatedAt?: string;
  pinned?: boolean;
  locked?: boolean;
}

export interface TopicSummaryResponse {
  id: number;
  title: string;
  status?: TopicStatus;
  updatedAt?: string;
  createdById?: number;
  createdBy?: string;
  postCount?: number;
  lastPostUpdatedAt?: string;
  lastPostUpdatedById?: number;
  lastPostUpdatedBy?: string;
  lastPostId?: number;
  lastActivityAt?: string;
  excerpt?: string;
}

// 목록 검색 파라미터 (q / in / fields + pageable)

export interface ListTopicsParams extends PageParams {
  q?: string;
  in?: string; // CSV
  includeHidden?: boolean;
}

// ---------- Post ----------
export interface CreatePostRequest {
  content: string;
}

export interface UpdatePostRequest {
  content: string;
}

export interface HidePostRequest {
  hidden: boolean;
  reason?: string;
}

export interface ListPostsParams extends PageParams {
  includeDeleted?: boolean;
  includeHidden?: boolean;
}

export interface PostResponse {
  id: number;
  content: string;
  createdById: number;
  createdBy: string;
  createdAt?: string;
  version: number;
  hidden?: boolean;
}

// ---------- Post Attachments ----------
export interface PostAttachmentResponse {
  attachmentId: number;
  name?: string;
  contentType?: string;
  size: number;
  createdBy: number;
  createdAt?: string;
  downloadUrl?: string;
}

// ---------- Members ----------
export type ForumMemberRole = "OWNER" | "ADMIN" | "MODERATOR" | "MEMBER" | string;

export interface UpsertForumMemberRequest {
  userId: number;
  role: ForumMemberRole;
}

export interface ForumMemberResponse {
  userId: number;
  role: ForumMemberRole;
  createdById: number;
  createdAt?: string;
}

export const PERMISSION_ACTIONS = [
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
  "PIN_TOPIC",
  "LOCK_TOPIC",
  "HIDE_POST",
  "MODERATE",
  "MANAGE_BOARD",
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const PERMISSION_EFFECTS = ["ALLOW", "DENY"] as const;
export type PermissionEffect = (typeof PERMISSION_EFFECTS)[number];

export const SUBJECT_TYPES = ["ROLE", "USER"] as const;
export type PermissionSubjectType = (typeof SUBJECT_TYPES)[number];

export const IDENTIFIER_TYPES = ["ID", "NAME"] as const;
export type PermissionIdentifierType = (typeof IDENTIFIER_TYPES)[number];

export const OWNERSHIP_SCOPES = ["ANY", "OWNER_ONLY", "NON_OWNER_ONLY"] as const;
export type PermissionOwnership = (typeof OWNERSHIP_SCOPES)[number];

export interface PermissionActionMetadata {
  action: PermissionAction;
  description: string;
  displayName: string;
}

export interface ForumAclRuleResponse {
  ruleId: number;
  forumId: number;
  categoryId?: number | null;
  role?: string | null;
  subjectType: PermissionSubjectType;
  identifierType: PermissionIdentifierType;
  subjectId?: number | null;
  subjectName?: string | null;
  action: PermissionAction;
  effect: PermissionEffect;
  ownership: PermissionOwnership;
  priority: number;
  enabled: boolean;
  description?: string | null;
  createdById?: number | null;
  createdAt?: string | null;
  updatedById?: number | null;
  updatedAt?: string | null;
}

export interface ForumAclRuleRequest {
  categoryId?: number | null;
  role?: string | null;
  subjectType: PermissionSubjectType;
  identifierType?: PermissionIdentifierType;
  subjectId?: number | null;
  subjectName?: string | null;
  action: PermissionAction;
  effect: PermissionEffect;
  ownership: PermissionOwnership;
  priority?: number;
  enabled?: boolean;
  description?: string;
}

export interface ForumPermissionDecision {
  action: PermissionAction;
  allowed: boolean;
  policyDecision: "ALLOW" | "DENY" | "ABSTAIN";
  aclDecision?: "ALLOW" | "DENY" | "ABSTAIN";
  denyReason?: string | null;
}

export interface ForumAuthzResponse {
  forumSlug: string;
  allowedActions: PermissionAction[];
  decisions: ForumPermissionDecision[];
}

export interface ForumAuthzActionPermission {
  action: PermissionAction;
  allowed: boolean;
}

export interface ForumAclSimulationRequest {
  action: PermissionAction;
  role?: string;
  userId?: number;
  subjectType?: PermissionSubjectType;
  identifierType?: PermissionIdentifierType;
  subjectId?: number;
  subjectName?: string;
  ownership?: PermissionOwnership;
  categoryId?: number;
  ownerId?: number;
  locked?: boolean;
  username?: string;
}
