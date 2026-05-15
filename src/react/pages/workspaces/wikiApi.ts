import { apiRequest } from "@/react/query/fetcher";
import type { PageResponse } from "@/types/studio/api-common";
import type {
  WikiArchiveRequest,
  WikiPageDto,
  WikiPageSummaryDto,
  WikiPageWriteRequest,
  WikiRevertRequest,
  WikiRevisionDto,
  WikiRevisionSummaryDto,
} from "@/types/studio/wiki";

function base(workspaceId: number) {
  return `/api/mgmt/workspaces/${workspaceId}/wiki`;
}

export const reactWorkspaceWikiApi = {
  pages: (workspaceId: number, params?: { q?: string; archived?: boolean }) =>
    apiRequest<WikiPageSummaryDto[] | PageResponse<WikiPageSummaryDto>>("get", `${base(workspaceId)}/pages`, {
      params,
    }),

  page: (workspaceId: number, pageSlug: string) =>
    apiRequest<WikiPageDto>("get", `${base(workspaceId)}/pages/${encodeURIComponent(pageSlug)}`),

  putPage: (workspaceId: number, pageSlug: string, payload: WikiPageWriteRequest) =>
    apiRequest<WikiPageDto, WikiPageWriteRequest>("put", `${base(workspaceId)}/pages/${encodeURIComponent(pageSlug)}`, {
      data: payload,
    }),

  archivePage: (workspaceId: number, pageSlug: string, payload: WikiArchiveRequest = {}) =>
    apiRequest<void, WikiArchiveRequest>("delete", `${base(workspaceId)}/pages/${encodeURIComponent(pageSlug)}`, {
      data: payload,
    }),

  revisions: (workspaceId: number, pageSlug: string) =>
    apiRequest<WikiRevisionSummaryDto[] | PageResponse<WikiRevisionSummaryDto>>(
      "get",
      `${base(workspaceId)}/pages/${encodeURIComponent(pageSlug)}/revisions`
    ),

  revision: (workspaceId: number, pageSlug: string, revisionId: number) =>
    apiRequest<WikiRevisionDto>(
      "get",
      `${base(workspaceId)}/pages/${encodeURIComponent(pageSlug)}/revisions/${revisionId}`
    ),

  revert: (workspaceId: number, pageSlug: string, revisionId: number, payload: WikiRevertRequest = {}) =>
    apiRequest<WikiPageDto, WikiRevertRequest>(
      "post",
      `${base(workspaceId)}/pages/${encodeURIComponent(pageSlug)}/revisions/${revisionId}/revert`,
      { data: payload }
    ),
};
