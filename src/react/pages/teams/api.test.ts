import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("@/react/query/fetcher", () => ({ apiRequest }));

import { reactTeamApi } from "@/react/pages/teams/api";

describe("reactTeamApi", () => {
  beforeEach(() => apiRequest.mockReset());

  it("normalizes the initial domain id contract to teamId", async () => {
    apiRequest.mockResolvedValue({
      content: [{
        id: 7,
        companyId: null,
        name: "공용 지식팀",
        slug: "public-knowledge",
        visibility: "PUBLIC",
        joinPolicy: "APPROVAL",
        status: "ACTIVE",
        ragEnabled: true,
        ragReplyMode: "MENTION",
      }],
      totalElements: 1,
    });

    const result = await reactTeamApi.list({ page: 0, size: 20 });

    expect(result.content[0].teamId).toBe(7);
    expect(apiRequest).toHaveBeenCalledWith("get", "/api/teams", {
      params: { page: 0, size: 20 },
      unwrapData: false,
    });
  });

  it("uses the additive Team workspace and knowledge-source endpoints", async () => {
    apiRequest
      .mockResolvedValueOnce({
        teamId: 7,
        roots: [{
          workspace: { id: 11, teamId: 7, name: "Root", slug: "root", path: "/root", depth: 0, visibility: "PRIVATE", archived: false },
          children: [],
        }],
      })
      .mockResolvedValueOnce([]);

    const tree = await reactTeamApi.workspaceTree(7);
    await reactTeamApi.knowledgeSources(7);

    expect(tree[0].workspace.id).toBe(11);
    expect(apiRequest).toHaveBeenNthCalledWith(1, "get", "/api/teams/7/workspaces/tree");
    expect(apiRequest).toHaveBeenNthCalledWith(2, "get", "/api/teams/7/knowledge-sources");
  });

  it("keeps root Workspace provisioning hidden and enabled by default", async () => {
    apiRequest.mockResolvedValue({
      id: 7,
      companyId: null,
      name: "공용 지식팀",
      slug: "public-knowledge",
      visibility: "PUBLIC",
      joinPolicy: "OPEN",
      status: "ACTIVE",
      ragEnabled: true,
      ragReplyMode: "MENTION",
    });

    await reactTeamApi.create({
      name: "공용 지식팀",
      slug: "public-knowledge",
      visibility: "PUBLIC",
      joinPolicy: "OPEN",
      ragEnabled: true,
      ragReplyMode: "MENTION",
    });

    expect(apiRequest).toHaveBeenCalledWith("post", "/api/teams", {
      data: expect.objectContaining({ provisionRootWorkspace: true }),
    });
  });

  it("uses the authenticated join and manager decision endpoints", async () => {
    apiRequest
      .mockResolvedValueOnce({ outcome: "PENDING", request: { requestId: 3, teamId: 7, userId: 9, status: "PENDING" } })
      .mockResolvedValueOnce([{ requestId: 3, teamId: 7, userId: 9, status: "PENDING" }])
      .mockResolvedValueOnce({ requestId: 3, teamId: 7, userId: 9, status: "APPROVED" });

    await reactTeamApi.join(7);
    await reactTeamApi.joinRequests(7);
    await reactTeamApi.approveJoinRequest(7, 3);

    expect(apiRequest).toHaveBeenNthCalledWith(1, "post", "/api/teams/7/join");
    expect(apiRequest).toHaveBeenNthCalledWith(2, "get", "/api/teams/7/join-requests", { params: { status: "PENDING" } });
    expect(apiRequest).toHaveBeenNthCalledWith(3, "post", "/api/teams/7/join-requests/3/approve");
  });
});
