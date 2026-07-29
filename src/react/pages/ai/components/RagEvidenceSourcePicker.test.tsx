// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RagEvidenceSourcePicker } from "./RagEvidenceSourcePicker";

const { listWebKnowledgeSources, createWebKnowledgeSource } = vi.hoisted(() => ({
  listWebKnowledgeSources: vi.fn(),
  createWebKnowledgeSource: vi.fn(),
}));

vi.mock("@/react/pages/ai/api", () => ({
  reactAiApi: {
    listWebKnowledgeSources,
    createWebKnowledgeSource,
    refreshWebKnowledgeSource: vi.fn(),
    cancelWebKnowledgeSource: vi.fn(),
    archiveWebKnowledgeSource: vi.fn(),
  },
}));

describe("RagEvidenceSourcePicker", () => {
  beforeEach(() => {
    listWebKnowledgeSources.mockReset();
    createWebKnowledgeSource.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("allows only completed revisions to be selected", async () => {
    listWebKnowledgeSources.mockResolvedValue([
      {
        sourceId: "wsrc-ready",
        workspaceId: 2,
        url: "https://example.org/ready",
        canonicalUrl: "https://example.org/ready",
        host: "example.org",
        displayName: "사용 가능 자료",
        embeddingDeploymentId: "embedding-default",
        status: "COMPLETED",
        currentRevisionId: "wrev-ready",
        createdAt: "2026-07-28T00:00:00Z",
        updatedAt: "2026-07-28T00:00:00Z",
      },
      {
        sourceId: "wsrc-pending",
        workspaceId: 2,
        url: "https://example.org/pending",
        host: "example.org",
        displayName: "수집 중 자료",
        embeddingDeploymentId: "embedding-default",
        status: "PENDING",
        createdAt: "2026-07-28T00:00:00Z",
        updatedAt: "2026-07-28T00:00:00Z",
      },
    ]);
    const onChange = vi.fn();

    render(
      <RagEvidenceSourcePicker
        workspaceId={2}
        embeddingDeploymentId="embedding-default"
        value={[]}
        onChange={onChange}
      />
    );

    await screen.findByText("사용 가능 자료");
    const checkboxes = screen.getAllByRole("checkbox");
    expect((checkboxes[0] as HTMLInputElement).disabled).toBe(false);
    expect((checkboxes[1] as HTMLInputElement).disabled).toBe(true);

    fireEvent.click(checkboxes[0]);
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([
        { sourceId: "wsrc-ready", revisionId: "wrev-ready" },
      ])
    );
  });

  it("displays read error when list request fails with 403 Forbidden", async () => {
    const error = new Error("Forbidden");
    (error as any).status = 403;
    listWebKnowledgeSources.mockRejectedValue(error);

    render(
      <RagEvidenceSourcePicker
        workspaceId={2}
        embeddingDeploymentId="embedding-default"
        value={[]}
        onChange={vi.fn()}
      />
    );

    await screen.findByText("이 workspace의 URL 자료를 조회할 수 없습니다.");
  });

  it("displays write warning when create request fails with 403 Forbidden", async () => {
    listWebKnowledgeSources.mockResolvedValue([
      {
        sourceId: "wsrc-ready",
        workspaceId: 2,
        url: "https://example.org/ready",
        host: "example.org",
        displayName: "기존 자료",
        embeddingDeploymentId: "embedding-default",
        status: "COMPLETED",
        currentRevisionId: "wrev-ready",
        createdAt: "2026-07-28T00:00:00Z",
        updatedAt: "2026-07-28T00:00:00Z",
      },
    ]);
    const createError = new Error("Forbidden");
    (createError as any).status = 403;
    createWebKnowledgeSource.mockRejectedValue(createError);

    render(
      <RagEvidenceSourcePicker
        workspaceId={2}
        embeddingDeploymentId="embedding-default"
        value={[]}
        onChange={vi.fn()}
      />
    );

    await screen.findByText("기존 자료");

    const input = screen.getByLabelText("공개 HTTPS URL");
    fireEvent.change(input, { target: { value: "https://example.org/new" } });

    const submitBtn = screen.getByRole("button", { name: "수집 시작" });
    fireEvent.click(submitBtn);

    await screen.findByText("기존 자료만 사용할 수 있으며 새 URL을 등록할 수 없습니다.");

    // Checkbox for completed existing source should remain enabled
    const checkbox = screen.getByRole("checkbox");
    expect((checkbox as HTMLInputElement).disabled).toBe(false);
  });

  it("renders external links with target=_blank and rel=noopener noreferrer", async () => {
    listWebKnowledgeSources.mockResolvedValue([
      {
        sourceId: "wsrc-link",
        workspaceId: 2,
        url: "https://example.org/link",
        canonicalUrl: "https://example.org/link",
        host: "example.org",
        displayName: "링크 자료",
        embeddingDeploymentId: "embedding-default",
        status: "COMPLETED",
        currentRevisionId: "wrev-link",
        createdAt: "2026-07-28T00:00:00Z",
        updatedAt: "2026-07-28T00:00:00Z",
      },
    ]);

    render(
      <RagEvidenceSourcePicker
        workspaceId={2}
        embeddingDeploymentId="embedding-default"
        value={[]}
        onChange={vi.fn()}
      />
    );

    const link = await screen.findByText("example.org");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
