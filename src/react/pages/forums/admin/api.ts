import type { AxiosRequestConfig, AxiosResponse } from "axios";
import { apiClient } from "@/react/api/client";
import { apiRequest } from "@/react/query/fetcher";
import type { PageResponse, WithEtag } from "@/types/studio/api-common";
import type {
  CategoryResponse,
  CreateCategoryRequest,
  CreateForumRequest,
  ForumAclRuleRequest,
  ForumAclRuleResponse,
  ForumAclSimulationRequest,
  ForumMemberResponse,
  ForumPermissionDecision,
  ForumResponse,
  ForumSummaryResponse,
  ListPostsParams,
  PermissionActionMetadata,
  PostResponse,
  TopicResponse,
  UpdateForumSettingsRequest,
  UpsertForumMemberRequest,
} from "@/types/studio/forums";

const ADMIN_BASE = "/api/mgmt/forums";
const PUBLIC_BASE = "/api/forums";

type ApiEnvelope<T> = {
  data?: T;
};

function unwrapPayload<T>(payload: ApiEnvelope<T> | T) {
  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    "data" in payload
  ) {
    return payload.data as T;
  }

  return payload as T;
}

async function requestWithMeta<T>(
  config: AxiosRequestConfig
): Promise<WithEtag<T>> {
  const response = await apiClient.request<ApiEnvelope<T> | T>({
    ...config,
    withCredentials: config.withCredentials ?? true,
  });

  return {
    data: unwrapPayload(response.data),
    etag: response.headers.etag as string | undefined,
  };
}

export interface ForumAuditEvent {
  auditId: number;
  at?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  forumId?: number;
  actorId?: number;
  detail?: Record<string, unknown> | string | null;
}

export const reactForumsAdminApi = {
  listForums(params?: { page?: number; size?: number; q?: string; in?: string }) {
    return apiRequest<PageResponse<ForumSummaryResponse>>("get", ADMIN_BASE, {
      params,
    });
  },

  getForum(forumSlug: string) {
    return requestWithMeta<ForumResponse>({
      method: "get",
      url: `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}`,
    });
  },

  createForum(payload: CreateForumRequest) {
    return requestWithMeta<ForumResponse>({
      method: "post",
      url: ADMIN_BASE,
      data: payload,
    });
  },

  updateForumSettings(
    forumSlug: string,
    payload: UpdateForumSettingsRequest,
    ifMatch: string
  ) {
    return requestWithMeta<ForumResponse>({
      method: "put",
      url: `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/settings`,
      data: payload,
      headers: { "If-Match": ifMatch },
    });
  },

  listCategories(forumSlug: string) {
    return apiRequest<CategoryResponse[]>(
      "get",
      `${PUBLIC_BASE}/${encodeURIComponent(forumSlug)}/categories`
    );
  },

  createCategory(forumSlug: string, payload: CreateCategoryRequest) {
    return apiRequest<{ categoryId: number }>(
      "post",
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/categories`,
      { data: payload }
    );
  },

  deleteCategory(forumSlug: string, categoryId: number) {
    return apiRequest<{ categoryId: number; deleted: boolean }>(
      "delete",
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/categories/${categoryId}`
    );
  },

  listMembers(forumSlug: string, params?: { page?: number; size?: number }) {
    return apiRequest<ForumMemberResponse[]>(
      "get",
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/members`,
      { params }
    );
  },

  addMember(forumSlug: string, payload: UpsertForumMemberRequest) {
    return apiRequest<{ userId: number }>(
      "post",
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/members`,
      { data: payload }
    );
  },

  updateMember(
    forumSlug: string,
    userId: number,
    payload: UpsertForumMemberRequest
  ) {
    return apiRequest<{ userId: number }>(
      "patch",
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/members/${userId}`,
      { data: payload }
    );
  },

  removeMember(forumSlug: string, userId: number) {
    return apiRequest<{ userId: number; removed: boolean }>(
      "delete",
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/members/${userId}`
    );
  },

  listPermissionActions(forumSlug: string) {
    return apiRequest<PermissionActionMetadata[]>(
      "get",
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/permissions/actions`
    );
  },

  listPermissionRules(
    forumSlug: string,
    params?: {
      categoryId?: number;
      action?: string;
      role?: string;
      enabled?: boolean;
      page?: number;
      size?: number;
    }
  ) {
    return apiRequest<ForumAclRuleResponse[]>(
      "get",
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/permissions`,
      { params }
    );
  },

  createPermissionRule(forumSlug: string, payload: ForumAclRuleRequest) {
    return apiRequest<ForumAclRuleResponse>(
      "post",
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/permissions`,
      { data: payload }
    );
  },

  updatePermissionRule(
    forumSlug: string,
    ruleId: number,
    payload: ForumAclRuleRequest
  ) {
    return apiRequest<ForumAclRuleResponse>(
      "put",
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/permissions/${ruleId}`,
      { data: payload }
    );
  },

  deletePermissionRule(forumSlug: string, ruleId: number) {
    return apiRequest<{ ruleId: number; deleted: boolean }>(
      "delete",
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/permissions/${ruleId}`
    );
  },

  simulatePermission(
    forumSlug: string,
    params: ForumAclSimulationRequest
  ) {
    return apiRequest<ForumPermissionDecision>(
      "get",
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/permissions/check`,
      { params }
    );
  },

  listAuditEvents(forumSlug: string, params?: { page?: number; size?: number }) {
    return apiRequest<PageResponse<ForumAuditEvent>>(
      "get",
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/audit`,
      { params }
    );
  },

  getTopic(forumSlug: string, topicId: number) {
    return requestWithMeta<TopicResponse>({
      method: "get",
      url: `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/topics/${topicId}`,
    });
  },

  listPosts(
    forumSlug: string,
    topicId: number,
    params?: ListPostsParams
  ) {
    return apiRequest<PostResponse[]>(
      "get",
      `${ADMIN_BASE}/${encodeURIComponent(forumSlug)}/topics/${topicId}/posts`,
      { params }
    );
  },
};
