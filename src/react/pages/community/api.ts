import { apiRequest } from "@/react/query/fetcher";
import type { PageResponse } from "@/types/studio/api-common";
import type {
  ForumResponse,
  ForumSummaryResponse,
  ListForumsParams,
  ListPostsParams,
  ListTopicsParams,
  PostResponse,
  TopicResponse,
  TopicSummaryResponse,
} from "@/types/studio/forums";

const PUBLIC_BASE = "/api/forums";

export const reactForumsPublicApi = {
  listForums(params?: ListForumsParams) {
    return apiRequest<PageResponse<ForumSummaryResponse>>("get", PUBLIC_BASE, {
      params,
    });
  },

  getForum(forumSlug: string) {
    return apiRequest<ForumResponse>(
      "get",
      `${PUBLIC_BASE}/${encodeURIComponent(forumSlug)}`
    );
  },

  listTopics(forumSlug: string, params?: ListTopicsParams) {
    return apiRequest<PageResponse<TopicSummaryResponse>>(
      "get",
      `${PUBLIC_BASE}/${encodeURIComponent(forumSlug)}/topics`,
      { params }
    );
  },

  getTopic(forumSlug: string, topicId: number) {
    return apiRequest<TopicResponse>(
      "get",
      `${PUBLIC_BASE}/${encodeURIComponent(forumSlug)}/topics/${topicId}`
    );
  },

  listPosts(forumSlug: string, topicId: number, params?: ListPostsParams) {
    return apiRequest<PostResponse[]>(
      "get",
      `${PUBLIC_BASE}/${encodeURIComponent(forumSlug)}/topics/${topicId}/posts`,
      { params }
    );
  },
};
