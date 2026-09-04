import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("@/react/query/fetcher", () => ({ apiRequest }));

import { reactWorkspaceApi } from "@/react/pages/workspaces/api";

describe("reactWorkspaceApi Team scope", () => {
  beforeEach(() => apiRequest.mockReset());

  it("uses teamId for filtering and root creation", async () => {
    apiRequest.mockResolvedValueOnce({ content: [] }).mockResolvedValueOnce({ id: 11, teamId: 7 });

    await reactWorkspaceApi.list({ teamId: 7, page: 0, size: 20 });
    await reactWorkspaceApi.createRoot({
      teamId: 7,
      name: "정책",
      slug: "policy",
      visibility: "PRIVATE",
    });

    expect(apiRequest).toHaveBeenNthCalledWith(1, "get", "/api/mgmt/workspaces", {
      params: { teamId: 7, page: 0, size: 20 },
    });
    expect(apiRequest).toHaveBeenNthCalledWith(2, "post", "/api/mgmt/workspaces", {
      data: {
        teamId: 7,
        name: "정책",
        slug: "policy",
        visibility: "PRIVATE",
      },
    });
  });

  it("uses Team-scoped list/root endpoints and permission-checked public move endpoint", async () => {
    apiRequest
      .mockResolvedValueOnce({ content: [] })
      .mockResolvedValueOnce({ id: 12, teamId: 7 })
      .mockResolvedValueOnce({ id: 12, parentId: 11 });

    await reactWorkspaceApi.listForTeam(7, { archived: false, page: 0, size: 100 });
    await reactWorkspaceApi.createTeamRoot(7, {
      name: "자료실",
      slug: "library",
      visibility: "PRIVATE",
    });
    await reactWorkspaceApi.changeParent(12, { newParentId: 11 });

    expect(apiRequest).toHaveBeenNthCalledWith(1, "get", "/api/teams/7/workspaces", {
      params: { archived: false, page: 0, size: 100 },
    });
    expect(apiRequest).toHaveBeenNthCalledWith(2, "post", "/api/teams/7/workspaces", {
      data: {
        teamId: 7,
        name: "자료실",
        slug: "library",
        visibility: "PRIVATE",
      },
    });
    expect(apiRequest).toHaveBeenNthCalledWith(3, "patch", "/api/workspaces/12/parent", {
      data: { newParentId: 11 },
    });
  });
});
