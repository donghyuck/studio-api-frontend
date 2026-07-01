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

export const reactWorkspaceApi = {
  list: (params?: {
    q?: string;
    companyId?: number;
    parentId?: number;
    rootOnly?: boolean;
    archived?: boolean;
    page?: number;
    size?: number;
    sort?: string;
  }) => apiRequest<PageResponse<WorkspaceRef>>("get", BASE, { params }),

  createRoot: (payload: WorkspaceCreateRequest) =>
    apiRequest<WorkspaceRef, WorkspaceCreateRequest>("post", BASE, { data: payload }),

  createChild: (workspaceId: number, payload: WorkspaceCreateRequest) =>
    apiRequest<WorkspaceRef, WorkspaceCreateRequest>("post", `${BASE}/${workspaceId}/children`, { data: payload }),

  get: (workspaceId: number) => apiRequest<WorkspaceRef>("get", `${BASE}/${workspaceId}`),

  children: (workspaceId: number) => apiRequest<WorkspaceRef[]>("get", `${BASE}/${workspaceId}/children`),

  ancestors: (workspaceId: number) => apiRequest<WorkspaceRef[]>("get", `${BASE}/${workspaceId}/ancestors`),

  descendants: (workspaceId: number) => apiRequest<WorkspaceRef[]>("get", `${BASE}/${workspaceId}/descendants`),

  tree: (workspaceId: number) => apiRequest<WorkspaceTreeNode>("get", `${BASE}/${workspaceId}/tree`),

  update: (workspaceId: number, payload: WorkspaceUpdateRequest) =>
    apiRequest<WorkspaceRef, WorkspaceUpdateRequest>("patch", `${BASE}/${workspaceId}`, { data: payload }),

  changeParent: (workspaceId: number, payload: WorkspaceParentChangeRequest) =>
    apiRequest<WorkspaceRef, WorkspaceParentChangeRequest>("patch", `${BASE}/${workspaceId}/parent`, { data: payload }),

  archive: (workspaceId: number, payload: WorkspaceStatusChangeRequest = {}) =>
    apiRequest<void, WorkspaceStatusChangeRequest>("post", `${BASE}/${workspaceId}/archive`, { data: payload }),

  activate: (workspaceId: number, payload: WorkspaceStatusChangeRequest = {}) =>
    apiRequest<WorkspaceRef, WorkspaceStatusChangeRequest>("post", `${BASE}/${workspaceId}/activate`, { data: payload }),

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
  ) => apiRequest<PageResponse<WorkspaceMemberRef>>("get", `${BASE}/${workspaceId}/members`, { params }),

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
  ) => apiRequest<PageResponse<WorkspaceMemberRef>>("get", `${BASE}/${workspaceId}/members/effective`, { params }),

  addMember: (workspaceId: number, payload: WorkspaceMemberRequest) =>
    apiRequest<WorkspaceMemberRef, WorkspaceMemberRequest>("post", `${BASE}/${workspaceId}/members`, { data: payload }),

  changeRole: (workspaceId: number, userId: number, payload: WorkspaceMemberRequest) =>
    apiRequest<WorkspaceMemberRef, WorkspaceMemberRequest>("put", `${BASE}/${workspaceId}/members/${userId}`, {
      data: payload,
    }),

  removeMember: (workspaceId: number, userId: number) =>
    apiRequest<void>("delete", `${BASE}/${workspaceId}/members/${userId}`),

  permissionsMe: (workspaceId: number) =>
    apiRequest<WorkspacePermissionSummary>("get", `${BASE}/${workspaceId}/permissions/me`),

  permissionActions: (workspaceId: number) =>
    apiRequest<WorkspacePermissionDefinition[]>("get", `${BASE}/${workspaceId}/permissions/actions`),
};
