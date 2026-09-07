export type WorkspaceVisibility = "PRIVATE" | "INTERNAL" | "PUBLIC";

export type WorkspaceRole = "VIEWER" | "EDITOR" | "ADMIN" | "OWNER";

export interface WorkspaceRef {
  id: number;
  teamId?: number | null;
  companyId?: number | null;
  parentId?: number | null;
  rootId?: number | null;
  name: string;
  slug: string;
  path: string;
  depth: number;
  visibility: WorkspaceVisibility;
  archived: boolean;
}

export interface WorkspaceTreeNode {
  workspace: WorkspaceRef;
  children: WorkspaceTreeNode[];
}

export interface WorkspaceMemberRef {
  workspaceId: number;
  userId: number;
  role: WorkspaceRole;
  inherited: boolean;
}

export interface WorkspacePermissionDefinition {
  action: string;
  description?: string | null;
}

export interface WorkspacePermissionSummary {
  workspaceId: number;
  userId: number;
  effectiveRole?: WorkspaceRole | null;
  actions: string[];
}

export interface WorkspaceCreateRequest {
  teamId?: number | null;
  companyId?: number | null;
  name: string;
  slug: string;
  visibility?: WorkspaceVisibility | null;
}

export interface WorkspaceUpdateRequest {
  name?: string | null;
  visibility?: WorkspaceVisibility | null;
}

export interface WorkspaceStatusChangeRequest {
  cascade?: boolean | null;
}

export interface WorkspaceMemberRequest {
  userId?: number | null;
  role: WorkspaceRole;
}

export interface WorkspaceParentChangeRequest {
  newParentId?: number | null;
}
