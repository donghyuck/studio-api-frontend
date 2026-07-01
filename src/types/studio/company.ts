export type CompanyStatus = "ACTIVE" | "ARCHIVED" | string;

export type CompanyRole = "MEMBER" | "BILLING_ADMIN" | "ADMIN" | "OWNER";

export interface CompanyDto {
  companyId: number;
  name: string;
  displayName?: string | null;
  domainName?: string | null;
  description?: string | null;
  status?: CompanyStatus | null;
  archivedAt?: string | null;
  archivedBy?: number | null;
  creationDate?: string | null;
  modifiedDate?: string | null;
  properties?: Record<string, unknown> | null;
}

export interface CompanyUpdateRequest {
  displayName?: string | null;
  domainName?: string | null;
  description?: string | null;
  properties?: Record<string, unknown> | null;
}

export interface CompanyMemberDto {
  companyId: number;
  userId: number;
  role: CompanyRole;
  status?: string | null;
  joinedAt?: string | null;
  joinedBy?: number | null;
  updatedAt?: string | null;
  updatedBy?: number | null;
}

export interface CompanyMemberRequest {
  userId?: number | null;
  role: CompanyRole;
}

export interface CompanyPermissionSummary {
  companyId: number;
  userId: number;
  actions: string[];
}

export interface CompanyPermissionRolePolicyDto {
  role: CompanyRole;
  actions: string[];
  defaultActions?: string[];
  override: boolean;
}

export interface CompanyPermissionRolePolicyRequest {
  role: CompanyRole;
  actions: string[];
  override: boolean;
}

export interface CompanyPermissionPolicyDto {
  companyId: number;
  roles: CompanyPermissionRolePolicyDto[];
}

export interface CompanyPermissionPolicyUpdateRequest {
  roles: CompanyPermissionRolePolicyRequest[];
}

export type CompanyJoinRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELED" | string;

export interface CompanyMemberKeyDto {
  keyId?: number;
  companyId: number;
  role: CompanyRole;
  memberKey?: string | null;
  status?: string | null;
  expiresAt?: string | null;
  maxUses?: number | null;
  usedCount?: number | null;
  createdAt?: string | null;
  createdBy?: number | null;
}

export interface CompanyMemberKeyCreateRequest {
  role: CompanyRole;
  expiresAt?: string | null;
  maxUses?: number | null;
}

export interface CompanyJoinRequestDto {
  requestId: number;
  companyId?: number | null;
  userId?: number | null;
  name?: string | null;
  email?: string | null;
  role?: CompanyRole | null;
  status: CompanyJoinRequestStatus;
  message?: string | null;
  requestedAt?: string | null;
  decidedAt?: string | null;
  decidedBy?: number | null;
}

export interface PublicCompanyJoinRequest {
  memberKey: string;
  name?: string | null;
  email?: string | null;
  message?: string | null;
}

export interface SelfCompanyJoinRequest {
  memberKey: string;
  message?: string | null;
}

export interface CompanyJoinDecisionRequest {
  role?: CompanyRole | null;
  reason?: string | null;
}
