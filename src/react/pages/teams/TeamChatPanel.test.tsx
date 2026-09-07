// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { RagChatCapabilitiesDto } from "@/types/studio/ai";
import type { TeamDto } from "@/types/studio/team";
import type { WorkspaceTreeNode } from "@/types/studio/workspace";

const { sendRagChatStream } = vi.hoisted(() => ({ sendRagChatStream: vi.fn() }));

vi.mock("@/react/pages/ai/api", () => ({ reactAiApi: { sendRagChatStream } }));

import { TeamChatPanel } from "@/react/pages/teams/TeamChatPanel";

const team: TeamDto = {
  teamId: 7,
  companyId: null,
  name: "공용 지식팀",
  slug: "public-knowledge",
  visibility: "PUBLIC",
  joinPolicy: "APPROVAL",
  status: "ACTIVE",
  ragEnabled: true,
  ragReplyMode: "MENTION",
};

const tree: WorkspaceTreeNode = {
  workspace: { id: 11, teamId: 7, name: "공용", slug: "public", path: "/public", depth: 0, visibility: "PRIVATE", archived: false },
  children: [{
    workspace: { id: 22, teamId: 7, parentId: 11, rootId: 11, name: "정책", slug: "policy", path: "/public/policy", depth: 1, visibility: "PRIVATE", archived: false },
    children: [],
  }],
};

function capabilities(teamRag?: RagChatCapabilitiesDto["teamRag"]): RagChatCapabilitiesDto {
  return {
    teamRag,
    answerPolicy: {} as RagChatCapabilitiesDto["answerPolicy"],
    sourcePolicy: {} as RagChatCapabilitiesDto["sourcePolicy"],
    indexedWeb: {} as RagChatCapabilitiesDto["indexedWeb"],
    answerPresentation: {} as RagChatCapabilitiesDto["answerPresentation"],
  };
}

describe("TeamChatPanel", () => {
  beforeEach(() => sendRagChatStream.mockReset());
  afterEach(() => cleanup());

  it("keeps Team Chat disabled until the server advertises the capability", () => {
    render(
      <TeamChatPanel
        team={team}
        workspaceTrees={[tree]}
        capabilities={capabilities(undefined)}
        capabilitiesLoading={false}
      />
    );

    expect(screen.getByText(/현재 서버가 Team RAG 계약을 제공하지 않습니다/)).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Team 질문" }) as HTMLInputElement).disabled).toBe(true);
    expect(sendRagChatStream).not.toHaveBeenCalled();
  });

  it("always sends teamId and adds workspaceId only for a selected subtree", async () => {
    sendRagChatStream.mockResolvedValue(undefined);
    render(
      <TeamChatPanel
        team={team}
        workspaceTrees={[tree]}
        capabilities={capabilities({
          enabled: true,
          maxObjectScopes: 32,
          workspaceSubtreeSupported: true,
          cacheIsolationVersion: "team-scope-v1",
        })}
        capabilitiesLoading={false}
      />
    );

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "검색 범위" }));
    fireEvent.click(screen.getByRole("option", { name: /정책/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Team 질문" }), { target: { value: "보안 정책을 알려줘" } });
    fireEvent.click(screen.getByRole("button", { name: "질문 보내기" }));

    await waitFor(() => expect(sendRagChatStream).toHaveBeenCalledTimes(1));
    expect(sendRagChatStream).toHaveBeenCalledWith(expect.objectContaining({
      teamId: 7,
      workspaceId: 22,
      ragQuery: "보안 정책을 알려줘",
      chat: { messages: [{ role: "user", content: "보안 정책을 알려줘" }] },
    }), expect.any(Object));
    const handlers = sendRagChatStream.mock.calls[0][1];
    act(() => {
      handlers.onRagStatus?.({ stage: "retrieval_complete", resultCount: 1 });
      handlers.onComplete?.({
        model: "gemini-2.5-flash",
        metadata: {
        resolvedModel: "gemini-2.5-flash",
        canonicalContent: "정책 자료에 따른 답변입니다. [1]",
        ragAnswerOutcome: {
          type: "ANSWERED",
          stage: "NONE",
          reasonCode: "NONE",
          retrievedResultCount: 1,
          acceptedResultCount: 1,
          packedEvidenceCount: 1,
          usedEvidenceIndexes: [1],
          citationValidationStatus: "INDEX_VALID",
          policyValidationStatus: "STRUCTURE_VALID",
          validationUnitCount: 1,
          citedValidationUnitCount: 1,
        },
        ragReferences: [{
          citationIndex: 1,
          usageStatus: "CITED",
          sourceName: "취업규칙.pdf",
          exactText: "사원은 업무시간 시작 전까지 출근하여 업무 준비를 해야 합니다.",
          supportStatus: "SOURCE_VERIFIED",
          origin: "DOCUMENT",
        }],
        },
      });
    });
    expect(await screen.findByText(/정책 자료에 따른 답변입니다/)).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "근거 1" }));
    expect(await screen.findByText(/사원은 업무시간 시작 전까지 출근하여 업무 준비를 해야 합니다/)).toBeTruthy();
  });
});
