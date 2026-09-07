import { apiRequest } from "@/react/query/fetcher";
import type { PageResponse } from "@/types/studio/api-common";
import type {
  WorkspaceCreateRequest,
  WorkspaceMemberRef,
  WorkspaceMemberRequest,
  WorkspaceParentChangeRequest,
  WorkspacePermissionDefinition,
  WorkspacePermissionSummary,
  WorkspaceRef,
  WorkspaceStatusChangeRequest,
  WorkspaceTreeNode,
  WorkspaceUpdateRequest,
} from "@/types/studio/workspace";

const BASE = "/api/mgmt/workspaces";
const PUBLIC_BASE = "/api/workspaces";

export const reactWorkspaceApi = {
  list: (params?: {
    q?: string;
    teamId?: number;
    parentId?: number;
    rootOnly?: boolean;
    archived?: boolean;
    page?: number;
    size?: number;
    sort?: string;
  }) => apiRequest<PageResponse<WorkspaceRef>>("get", BASE, { params }),

  listForTeam: (teamId: number, params?: {
    q?: string;
    parentId?: number;
    rootOnly?: boolean;
    archived?: boolean;
    page?: number;
    size?: number;
    sort?: string;
  }) => apiRequest<PageResponse<WorkspaceRef>>("get", `/api/teams/${teamId}/workspaces`, { params }),

  createRoot: (payload: WorkspaceCreateRequest) =>
    apiRequest<WorkspaceRef, WorkspaceCreateRequest>("post", BASE, { data: payload }),

  createTeamRoot: (teamId: number, payload: WorkspaceCreateRequest) =>
    apiRequest<WorkspaceRef, WorkspaceCreateRequest>("post", `/api/teams/${teamId}/workspaces`, {
      data: { ...payload, teamId },
    }),

  createChild: (workspaceId: number, payload: WorkspaceCreateRequest) =>
    apiRequest<WorkspaceRef, WorkspaceCreateRequest>("post", `${PUBLIC_BASE}/${workspaceId}/children`, { data: payload }),

  get: (workspaceId: number) => apiRequest<WorkspaceRef>("get", `${PUBLIC_BASE}/${workspaceId}`),

  children: (workspaceId: number) => apiRequest<WorkspaceRef[]>("get", `${PUBLIC_BASE}/${workspaceId}/children`),

  ancestors: (workspaceId: number) => apiRequest<WorkspaceRef[]>("get", `${PUBLIC_BASE}/${workspaceId}/ancestors`),

  descendants: (workspaceId: number) => apiRequest<WorkspaceRef[]>("get", `${PUBLIC_BASE}/${workspaceId}/descendants`),

  tree: (workspaceId: number) => apiRequest<WorkspaceTreeNode>("get", `${PUBLIC_BASE}/${workspaceId}/tree`),

  update: (workspaceId: number, payload: WorkspaceUpdateRequest) =>
    apiRequest<WorkspaceRef, WorkspaceUpdateRequest>("patch", `${PUBLIC_BASE}/${workspaceId}`, { data: payload }),

  changeParent: (workspaceId: number, payload: WorkspaceParentChangeRequest) =>
    apiRequest<WorkspaceRef, WorkspaceParentChangeRequest>("patch", `${PUBLIC_BASE}/${workspaceId}/parent`, { data: payload }),

  archive: (workspaceId: number, payload: WorkspaceStatusChangeRequest = {}) =>
    apiRequest<void, WorkspaceStatusChangeRequest>("post", `${PUBLIC_BASE}/${workspaceId}/archive`, { data: payload }),

  activate: (workspaceId: number, payload: WorkspaceStatusChangeRequest = {}) =>
    apiRequest<WorkspaceRef, WorkspaceStatusChangeRequest>("post", `${PUBLIC_BASE}/${workspaceId}/activate`, { data: payload }),

  members: (
    workspaceId: number,
    params?: {
      q?: string;
      keyword?: string;
      role?: string;
      inherited?: boolean;
      page?: number;
      size?: number;
      sort?: string;
    }
  ) => apiRequest<PageResponse<WorkspaceMemberRef>>("get", `${PUBLIC_BASE}/${workspaceId}/members`, { params }),

  effectiveMembers: (
    workspaceId: number,
    params?: {
      q?: string;
      keyword?: string;
      role?: string;
      inherited?: boolean;
      page?: number;
      size?: number;
      sort?: string;
    }
  ) => apiRequest<PageResponse<WorkspaceMemberRef>>("get", `${PUBLIC_BASE}/${workspaceId}/members/effective`, { params }),

  addMember: (workspaceId: number, payload: WorkspaceMemberRequest) =>
    apiRequest<WorkspaceMemberRef, WorkspaceMemberRequest>("post", `${PUBLIC_BASE}/${workspaceId}/members`, { data: payload }),

  changeRole: (workspaceId: number, userId: number, payload: WorkspaceMemberRequest) =>
    apiRequest<WorkspaceMemberRef, WorkspaceMemberRequest>("put", `${PUBLIC_BASE}/${workspaceId}/members/${userId}`, {
      data: payload,
    }),

  removeMember: (workspaceId: number, userId: number) =>
    apiRequest<void>("delete", `${PUBLIC_BASE}/${workspaceId}/members/${userId}`),

  permissionsMe: (workspaceId: number) =>
    apiRequest<WorkspacePermissionSummary>("get", `${PUBLIC_BASE}/${workspaceId}/permissions/me`),

  permissionActions: (workspaceId: number) =>
    apiRequest<WorkspacePermissionDefinition[]>("get", `${PUBLIC_BASE}/${workspaceId}/permissions/actions`),
};
