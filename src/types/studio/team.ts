import type { WorkspaceTreeNode } from "@/types/studio/workspace";

export type TeamRole = "OWNER" | "ADMIN" | "MEMBER";
export type TeamVisibility = "PUBLIC" | "UNLISTED" | "PRIVATE";
export type TeamJoinPolicy = "OPEN" | "APPROVAL" | "INVITE_ONLY";
export type TeamStatus = "ACTIVE" | "ARCHIVED";
export type TeamRagReplyMode = "MANUAL" | "MENTION" | "AUTO";
export type TeamJoinOutcome = "JOINED" | "ALREADY_MEMBER" | "PENDING";
export type TeamJoinRequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type TeamKnowledgeSourceType = "ATTACHMENT" | "WIKI" | "WEB_SOURCE" | "TEXT" | "TEST" | string;

export interface TeamDto {
  teamId: number;
  /** 초기 Team contract의 domain id 응답과 호환하기 위한 원본 필드입니다. */
  id?: number;
  companyId?: number | null;
  name: string;
  slug: string;
  description?: string | null;
  visibility: TeamVisibility;
  joinPolicy: TeamJoinPolicy;
  status: TeamStatus;
  rootWorkspaceId?: number | null;
  ragEnabled: boolean;
  ragReplyMode: TeamRagReplyMode;
  permissionVersion?: number;
  memberCount?: number;
  workspaceCount?: number;
  knowledgeSourceCount?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface TeamCreateRequest {
  companyId?: number | null;
  name: string;
  slug: string;
  description?: string | null;
  visibility: TeamVisibility;
  joinPolicy: TeamJoinPolicy;
  ragEnabled: boolean;
  ragReplyMode: TeamRagReplyMode;
  /** 일반 UI에는 노출하지 않는 migration 전용 값이며 API 경계가 기본 true를 보장합니다. */
  provisionRootWorkspace?: boolean;
}

export interface TeamUpdateRequest {
  companyId?: number;
  clearCompanyAssignment?: boolean;
  name?: string;
  description?: string | null;
  visibility?: TeamVisibility;
  joinPolicy?: TeamJoinPolicy;
  ragEnabled?: boolean;
  ragReplyMode?: TeamRagReplyMode;
}

export interface TeamMemberDto {
  teamId: number;
  userId: number;
  role: TeamRole;
  status: "ACTIVE" | "INACTIVE" | string;
  username?: string | null;
  name?: string | null;
  email?: string | null;
  createdAt?: string | null;
}

export interface TeamMemberRequest {
  userId?: number;
  role: TeamRole;
}

export interface TeamJoinRequestDto {
  requestId: number;
  teamId: number;
  userId: number;
  status: TeamJoinRequestStatus;
  requestedAt?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: number | null;
}

export interface TeamJoinResultDto {
  outcome: TeamJoinOutcome;
  member?: TeamMemberDto | null;
  request?: TeamJoinRequestDto | null;
}

export interface TeamKnowledgeSourceDto {
  teamId: number;
  workspaceId: number;
  sourceType: TeamKnowledgeSourceType;
  sourceId: string;
  revisionId?: string | null;
  partitionId?: string | null;
  title?: string | null;
  status?: string | null;
  updatedAt?: string | null;
}

export interface TeamWorkspaceTreeDto {
  teamId: number;
  roots: WorkspaceTreeNode[];
}
