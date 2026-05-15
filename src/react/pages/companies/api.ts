import { apiRequest } from "@/react/query/fetcher";
import type { PageResponse } from "@/types/studio/api-common";
import type {
  CompanyDto,
  CompanyJoinDecisionRequest,
  CompanyJoinRequestDto,
  CompanyMemberDto,
  CompanyMemberKeyCreateRequest,
  CompanyMemberKeyDto,
  CompanyMemberRequest,
  PublicCompanyJoinRequest,
  SelfCompanyJoinRequest,
  CompanyPermissionSummary,
  CompanyPermissionPolicyDto,
  CompanyPermissionPolicyUpdateRequest,
  CompanyUpdateRequest,
} from "@/types/studio/company";

const BASE = "/api/mgmt/companies";

type PagePayload<T> = PageResponse<T> | T[] | { data?: PageResponse<T> | T[] | { content?: T[]; page?: PageMeta } };
type PageMeta = {
  number?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
};

function normalizePage<T>(payload: PagePayload<T>): PageResponse<T> {
  const raw = payload && typeof payload === "object" && !Array.isArray(payload) && "data" in payload && payload.data
    ? payload.data
    : payload;
  if (Array.isArray(raw)) {
    return {
      content: raw,
      totalElements: raw.length,
      totalPages: 1,
      size: raw.length,
      number: 0,
    };
  }

  const page = raw as PageResponse<T> & { page?: PageMeta };
  return {
    ...page,
    content: page.content ?? [],
    totalElements: page.totalElements ?? page.page?.totalElements ?? page.content?.length ?? 0,
    totalPages: page.totalPages ?? page.page?.totalPages ?? 0,
    size: page.size ?? page.page?.size ?? 0,
    number: page.number ?? page.page?.number ?? 0,
  };
}

export const reactCompanyApi = {
  list: (params?: { q?: string; page?: number; size?: number; sort?: string }) =>
    apiRequest<PagePayload<CompanyDto>>("get", BASE, { params, unwrapData: false }).then(normalizePage),

  create: (payload: Partial<CompanyDto>) =>
    apiRequest<CompanyDto, Partial<CompanyDto>>("post", BASE, { data: payload }),

  get: (companyId: number) => apiRequest<CompanyDto>("get", `${BASE}/${companyId}`),

  update: (companyId: number, payload: CompanyUpdateRequest) =>
    apiRequest<CompanyDto, CompanyUpdateRequest>("put", `${BASE}/${companyId}`, { data: payload }),

  archive: (companyId: number) => apiRequest<CompanyDto>("post", `${BASE}/${companyId}/archive`),

  members: (companyId: number, params?: { page?: number; size?: number; sort?: string }) =>
    apiRequest<PagePayload<CompanyMemberDto>>("get", `${BASE}/${companyId}/members`, {
      params,
      unwrapData: false,
    }).then(normalizePage),

  addMember: (companyId: number, payload: CompanyMemberRequest) =>
    apiRequest<CompanyMemberDto, CompanyMemberRequest>("post", `${BASE}/${companyId}/members`, { data: payload }),

  changeMemberRole: (companyId: number, userId: number, payload: CompanyMemberRequest) =>
    apiRequest<CompanyMemberDto, CompanyMemberRequest>("put", `${BASE}/${companyId}/members/${userId}`, {
      data: payload,
    }),

  removeMember: (companyId: number, userId: number) =>
    apiRequest<void>("delete", `${BASE}/${companyId}/members/${userId}`),

  permissionsMe: (companyId: number) =>
    apiRequest<CompanyPermissionSummary>("get", `${BASE}/${companyId}/permissions/me`),

  permissionActions: (companyId: number) =>
    apiRequest<string[]>("get", `${BASE}/${companyId}/permissions/actions`),

  permissionPolicy: (companyId: number) =>
    apiRequest<CompanyPermissionPolicyDto>("get", `${BASE}/${companyId}/permissions/policy`),

  updatePermissionPolicy: (companyId: number, payload: CompanyPermissionPolicyUpdateRequest) =>
    apiRequest<CompanyPermissionPolicyDto, CompanyPermissionPolicyUpdateRequest>(
      "put",
      `${BASE}/${companyId}/permissions/policy`,
      { data: payload }
    ),

  createMemberKey: (companyId: number, payload: CompanyMemberKeyCreateRequest) =>
    apiRequest<CompanyMemberKeyDto, CompanyMemberKeyCreateRequest>("post", `${BASE}/${companyId}/member-keys`, {
      data: payload,
    }),

  joinRequests: (companyId: number, params?: { status?: string; page?: number; size?: number; sort?: string }) =>
    apiRequest<PagePayload<CompanyJoinRequestDto>>("get", `${BASE}/${companyId}/member-join-requests`, {
      params,
      unwrapData: false,
    }).then(normalizePage),

  approveJoinRequest: (companyId: number, requestId: number, payload: CompanyJoinDecisionRequest) =>
    apiRequest<CompanyJoinRequestDto, CompanyJoinDecisionRequest>(
      "post",
      `${BASE}/${companyId}/member-join-requests/${requestId}/approve`,
      { data: payload }
    ),

  rejectJoinRequest: (companyId: number, requestId: number, payload: CompanyJoinDecisionRequest) =>
    apiRequest<CompanyJoinRequestDto, CompanyJoinDecisionRequest>(
      "post",
      `${BASE}/${companyId}/member-join-requests/${requestId}/reject`,
      { data: payload }
    ),

  requestJoinPublic: (payload: PublicCompanyJoinRequest) =>
    apiRequest<CompanyJoinRequestDto, PublicCompanyJoinRequest>("post", "/api/company-join-requests", {
      data: payload,
    }),

  requestJoinSelf: (payload: SelfCompanyJoinRequest) =>
    apiRequest<CompanyJoinRequestDto, SelfCompanyJoinRequest>("post", "/api/self/company-join-requests", {
      data: payload,
    }),
};
