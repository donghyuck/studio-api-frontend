// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { TeamDto } from "@/types/studio/team";

const { join, joinRequests, approveJoinRequest, rejectJoinRequest } = vi.hoisted(() => ({
  join: vi.fn(),
  joinRequests: vi.fn(),
  approveJoinRequest: vi.fn(),
  rejectJoinRequest: vi.fn(),
}));

vi.mock("@/react/pages/teams/api", () => ({
  reactTeamApi: { join, joinRequests, approveJoinRequest, rejectJoinRequest },
}));

import { TeamJoinPanel } from "@/react/pages/teams/TeamJoinPanel";

function team(overrides: Partial<TeamDto> = {}): TeamDto {
  return {
    teamId: 7,
    companyId: null,
    name: "공용 지식팀",
    slug: "public-knowledge",
    visibility: "PUBLIC",
    joinPolicy: "APPROVAL",
    status: "ACTIVE",
    ragEnabled: true,
    ragReplyMode: "MENTION",
    ...overrides,
  };
}

describe("TeamJoinPanel", () => {
  beforeEach(() => {
    join.mockReset();
    joinRequests.mockReset();
    approveJoinRequest.mockReset();
    rejectJoinRequest.mockReset();
  });
  afterEach(() => cleanup());

  it("creates an approval request without probing manager data for a non-member", async () => {
    join.mockResolvedValue({
      outcome: "PENDING",
      request: { requestId: 3, teamId: 7, userId: 9, status: "PENDING" },
    });
    const onJoined = vi.fn();
    render(
      <TeamJoinPanel
        team={team()}
        accessConfirmed={false}
        tryManageRequests={false}
        onJoined={onJoined}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "가입 요청" }));

    expect(await screen.findByText("가입 요청이 승인 대기 중입니다.")).toBeTruthy();
    expect(join).toHaveBeenCalledWith(7);
    expect(joinRequests).not.toHaveBeenCalled();
    expect(onJoined).not.toHaveBeenCalled();
  });

  it("keeps invite-only Team joining disabled", () => {
    render(
      <TeamJoinPanel
        team={team({ joinPolicy: "INVITE_ONLY" })}
        accessConfirmed={false}
        tryManageRequests={false}
        onJoined={vi.fn()}
      />
    );

    expect(screen.getByText("초대받은 사용자만 가입할 수 있습니다.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "초대 필요" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows and resolves pending requests only when the manager endpoint succeeds", async () => {
    joinRequests
      .mockResolvedValueOnce([{ requestId: 3, teamId: 7, userId: 9, status: "PENDING", requestedAt: "2026-08-31T00:00:00Z" }])
      .mockResolvedValueOnce([]);
    approveJoinRequest.mockResolvedValue({ requestId: 3, teamId: 7, userId: 9, status: "APPROVED" });
    const onManagementAccessChange = vi.fn();
    render(
      <TeamJoinPanel
        team={team()}
        accessConfirmed
        currentRole="ADMIN"
        tryManageRequests
        onJoined={vi.fn()}
        onManagementAccessChange={onManagementAccessChange}
      />
    );

    expect(await screen.findByText("User #9")).toBeTruthy();
    expect(onManagementAccessChange).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "승인" }));

    await waitFor(() => expect(approveJoinRequest).toHaveBeenCalledWith(7, 3));
    await waitFor(() => expect(joinRequests).toHaveBeenCalledTimes(2));
  });
});
