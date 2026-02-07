import type {
  CategoryResponse,
  CreateTopicRequest,
  ForumAuthzActionPermission,
  ForumResponse,
  ForumSummaryResponse,
  ForumAclSimulationRequest,
  ForumPermissionDecision,
  ListForumsParams,
  ListPostsParams,
  ListTopicsParams,
  PostAttachmentResponse,
  PostResponse,
  TopicResponse,
  TopicSummaryResponse,
  UpdatePostRequest,
  UpdateTopicRequest,
} from "@/types/studio/forums";
import { api } from "@/data/http";
import type { PageResponse } from "@/types/studio/api-common";

export const PUBLIC_BASE = "/api/forums";

export const forumsPublicApi = {
  async listForums(params?: ListForumsParams) {
    return api.get<PageResponse<ForumSummaryResponse>>(PUBLIC_BASE, { params });
  },

  async getForum(forumSlug: string) {
    const res = await api.getWithMeta<ForumResponse>(
      `${PUBLIC_BASE}/${encodeURIComponent(forumSlug)}`
    );
    return { data: res.data, etag: res.headers?.["etag"] as string | undefined };
  },

  async listCategories(forumSlug: string) {
    return api.get<CategoryResponse[]>(
      `${PUBLIC_BASE}/${encodeURIComponent(forumSlug)}/categories`
    );
  },

  async listTopics(forumSlug: string, params?: ListTopicsParams) {
    return api.get<PageResponse<TopicSummaryResponse>>(
      `${PUBLIC_BASE}/${encodeURIComponent(forumSlug)}/topics`,
      { params }
    );
  },

  async getTopic(forumSlug: string, topicId: number) {
    const res = await api.getWithMeta<TopicResponse>(
      `${PUBLIC_BASE}/${encodeURIComponent(forumSlug)}/topics/${topicId}`
    );
    return { data: res.data, etag: res.headers?.["etag"] as string | undefined };
  },

  async createTopic(forumSlug: string, payload: CreateTopicRequest) {
    return api.post<{ topicId: number }>(
      `${PUBLIC_BASE}/${encodeURIComponent(forumSlug)}/topics`,
      payload
    );
  },

  async createTopicWithCategory(
    forumSlug: string,
    categoryId: number,
    payload: CreateTopicRequest
  ) {
    return api.post<{ topicId: number }>(
      `${PUBLIC_BASE}/${encodeURIComponent(
        forumSlug
      )}/categories/${categoryId}/topics`,
      payload
    );
  },

  async updateTopic(
    forumSlug: string,
    topicId: number,
    payload: UpdateTopicRequest,
    ifMatch?: string
  ) {
    const res = await api.patchWithMeta<TopicResponse>(
      `${PUBLIC_BASE}/${encodeURIComponent(forumSlug)}/topics/${topicId}`,
      payload,
      ifMatch ? { headers: { "If-Match": ifMatch } } : undefined
    );
    return { data: res.data, etag: res.headers?.["etag"] as string | undefined };
  },

  async deleteTopic(forumSlug: string, topicId: number, ifMatch?: string) {
    return api.delete<{ topicId: number; deleted: boolean }>(
      `${PUBLIC_BASE}/${encodeURIComponent(forumSlug)}/topics/${topicId}`,
      null,
      ifMatch ? { headers: { "If-Match": ifMatch } } : undefined
    );
  },

  async listPosts(
    forumSlug: string,
    topicId: number,
    params?: ListPostsParams
  ) {
    return api.get<PostResponse[]>(
      `${PUBLIC_BASE}/${encodeURIComponent(forumSlug)}/topics/${topicId}/posts`,
      { params }
    );
  },

  async updatePost(
    forumSlug: string,
    topicId: number,
    postId: number,
    payload: UpdatePostRequest,
    ifMatch?: string
  ) {
    return api.patch<{ postId: number; updated: boolean }>(
      `${PUBLIC_BASE}/${encodeURIComponent(forumSlug)}/topics/${topicId}/posts/${postId}`,
      payload,
      ifMatch ? { headers: { "If-Match": ifMatch } } : undefined
    );
  },

  async deletePost(
    forumSlug: string,
    topicId: number,
    postId: number,
    ifMatch?: string
  ) {
    return api.delete<{ postId: number; deleted: boolean }>(
      `${PUBLIC_BASE}/${encodeURIComponent(forumSlug)}/topics/${topicId}/posts/${postId}`,
      null,
      ifMatch ? { headers: { "If-Match": ifMatch } } : undefined
    );
  },

  async uploadPostAttachment(
    forumSlug: string,
    topicId: number,
    postId: number,
    file: File
  ) {
    const form = new FormData();
    form.append("file", file);
    return api.post<PostAttachmentResponse>(
      `${PUBLIC_BASE}/${encodeURIComponent(
        forumSlug
      )}/topics/${topicId}/posts/${postId}/attachments`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
  },

  async listPostAttachments(
    forumSlug: string,
    topicId: number,
    postId: number
  ) {
    return api.get<PostAttachmentResponse[]>(
      `${PUBLIC_BASE}/${encodeURIComponent(
        forumSlug
      )}/topics/${topicId}/posts/${postId}/attachments`
    );
  },

  async getPostAttachment(
    forumSlug: string,
    topicId: number,
    postId: number,
    attachmentId: number
  ) {
    return api.get<PostAttachmentResponse>(
      `${PUBLIC_BASE}/${encodeURIComponent(
        forumSlug
      )}/topics/${topicId}/posts/${postId}/attachments/${attachmentId}`
    );
  },

  async deletePostAttachment(
    forumSlug: string,
    topicId: number,
    postId: number,
    attachmentId: number
  ) {
    return api.delete<void>(
      `${PUBLIC_BASE}/${encodeURIComponent(
        forumSlug
      )}/topics/${topicId}/posts/${postId}/attachments/${attachmentId}`
    );
  },

  async getForumAuthz(forumSlug: string) {
    return api.get<ForumAuthzActionPermission[]>(
      `${PUBLIC_BASE}/${encodeURIComponent(forumSlug)}/authz`
    );
  },

  async simulatePermission(forumSlug: string, payload: ForumAclSimulationRequest) {
    return api.post<ForumPermissionDecision>(
      `${PUBLIC_BASE}/${encodeURIComponent(forumSlug)}/authz/simulate`,
      payload
    );
  },
};
