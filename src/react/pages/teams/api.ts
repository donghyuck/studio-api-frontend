import { apiRequest } from "@/react/query/fetcher";
import type { PageResponse } from "@/types/studio/api-common";
import type {
  TeamCreateRequest,
  TeamDto,
  TeamKnowledgeSourceDto,
  TeamJoinRequestDto,
  TeamJoinRequestStatus,
  TeamJoinResultDto,
  TeamMemberDto,
  TeamMemberRequest,
  TeamUpdateRequest,
  TeamWorkspaceTreeDto,
} from "@/types/studio/team";
import type { WorkspaceTreeNode } from "@/types/studio/workspace";

const BASE = "/api/teams";

type PageMeta = {
  number?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
};

type PagePayload<T> =
  | PageResponse<T>
  | T[]
  | { data?: PageResponse<T> | T[] | { content?: T[]; page?: PageMeta } };

type TeamPayload = Omit<TeamDto, "teamId"> & { teamId?: number; id?: number };

function normalizeTeam(payload: TeamPayload): TeamDto {
  const teamId = payload.teamId ?? payload.id;
  if (!teamId) {
    throw new Error("Team 응답에 teamId 또는 id가 없습니다.");
  }
  return { ...payload, teamId };
}

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

function normalizeWorkspaceTrees(
  payload: TeamWorkspaceTreeDto | WorkspaceTreeNode | WorkspaceTreeNode[],
): WorkspaceTreeNode[] {
  if (Array.isArray(payload)) return payload;
  if ("roots" in payload) return payload.roots;
  return [payload];
}

/**
 * Team API의 클라이언트 선행 계약입니다.
 * 서버 구현 전에는 404/501을 화면의 capability fallback으로 처리합니다.
 */
export const reactTeamApi = {
  list: (params?: { q?: string; status?: string; page?: number; size?: number; sort?: string }) =>
    apiRequest<PagePayload<TeamPayload>>("get", BASE, { params, unwrapData: false })
      .then(normalizePage)
      .then((page) => ({ ...page, content: page.content.map(normalizeTeam) })),

  create: (payload: TeamCreateRequest) =>
    apiRequest<TeamPayload, TeamCreateRequest>("post", BASE, {
      data: { ...payload, provisionRootWorkspace: payload.provisionRootWorkspace ?? true },
    }).then(normalizeTeam),

  get: (teamId: number) => apiRequest<TeamPayload>("get", `${BASE}/${teamId}`).then(normalizeTeam),

  update: (teamId: number, payload: TeamUpdateRequest) =>
    apiRequest<TeamPayload, TeamUpdateRequest>("patch", `${BASE}/${teamId}`, { data: payload }).then(normalizeTeam),

  archive: (teamId: number) => apiRequest<TeamPayload>("post", `${BASE}/${teamId}/archive`).then(normalizeTeam),

  members: (teamId: number) =>
    apiRequest<PagePayload<TeamMemberDto>>("get", `${BASE}/${teamId}/members`, {
      unwrapData: false,
    }).then(normalizePage),

  addMember: (teamId: number, payload: TeamMemberRequest) =>
    apiRequest<TeamMemberDto, TeamMemberRequest>("post", `${BASE}/${teamId}/members`, { data: payload }),

  changeMemberRole: (teamId: number, userId: number, payload: TeamMemberRequest) =>
    apiRequest<TeamMemberDto, TeamMemberRequest>("patch", `${BASE}/${teamId}/members/${userId}`, {
      data: payload,
    }),

  removeMember: (teamId: number, userId: number) =>
    apiRequest<void>("delete", `${BASE}/${teamId}/members/${userId}`),

  join: (teamId: number) => apiRequest<TeamJoinResultDto>("post", `${BASE}/${teamId}/join`),

  joinRequests: (teamId: number, status: TeamJoinRequestStatus = "PENDING") =>
    apiRequest<TeamJoinRequestDto[]>("get", `${BASE}/${teamId}/join-requests`, { params: { status } }),

  approveJoinRequest: (teamId: number, requestId: number) =>
    apiRequest<TeamJoinRequestDto>("post", `${BASE}/${teamId}/join-requests/${requestId}/approve`),

  rejectJoinRequest: (teamId: number, requestId: number) =>
    apiRequest<TeamJoinRequestDto>("post", `${BASE}/${teamId}/join-requests/${requestId}/reject`),

  workspaceTree: (teamId: number) =>
    apiRequest<TeamWorkspaceTreeDto | WorkspaceTreeNode | WorkspaceTreeNode[]>(
      "get",
      `${BASE}/${teamId}/workspaces/tree`,
    ).then(normalizeWorkspaceTrees),

  knowledgeSources: (teamId: number) =>
    apiRequest<TeamKnowledgeSourceDto[]>("get", `${BASE}/${teamId}/knowledge-sources`),
};
