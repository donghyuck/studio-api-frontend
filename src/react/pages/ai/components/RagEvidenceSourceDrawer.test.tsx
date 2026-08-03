// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RagEvidenceSourceDrawer } from "./RagEvidenceSourceDrawer";
import type { WorkspaceRef } from "@/types/studio/workspace";

vi.mock("@/react/pages/ai/api", () => ({
  reactAiApi: {
    listWebKnowledgeSources: vi.fn().mockResolvedValue([]),
    createWebKnowledgeSource: vi.fn(),
    refreshWebKnowledgeSource: vi.fn(),
    cancelWebKnowledgeSource: vi.fn(),
    archiveWebKnowledgeSource: vi.fn(),
  },
}));

describe("RagEvidenceSourceDrawer", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders drawer header", () => {
    render(
      <RagEvidenceSourceDrawer
        open={true}
        onClose={vi.fn()}
        value={[]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("참고자료 관리")).toBeDefined();
  });

  it("displays status notices for capability loading, disabled, missing workspace", () => {
    render(
      <RagEvidenceSourceDrawer
        open={true}
        onClose={vi.fn()}
        capabilitiesLoading={true}
        value={[]}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText("URL 자료 기능을 확인하고 있습니다")).toBeDefined();
    cleanup();

    render(
      <RagEvidenceSourceDrawer
        open={true}
        onClose={vi.fn()}
        capabilitiesError="Network Error"
        value={[]}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText("URL 자료 기능 상태를 확인하지 못했습니다: Network Error")).toBeDefined();
    cleanup();

    render(
      <RagEvidenceSourceDrawer
        open={true}
        onClose={vi.fn()}
        capabilities={{ enabled: false, maxSelectedSources: 10, supportedSchemes: ["https"], maxUrlLength: 2048 }}
        value={[]}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText("서버에서 URL 수집 기능이 비활성화되어 있습니다")).toBeDefined();
    cleanup();

    render(
      <RagEvidenceSourceDrawer
        open={true}
        onClose={vi.fn()}
        capabilities={{ enabled: true, maxSelectedSources: 10, supportedSchemes: ["https"], maxUrlLength: 2048 }}
        workspaceId={null}
        value={[]}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText("자료를 저장할 workspace를 선택하세요")).toBeDefined();
    cleanup();

    render(
      <RagEvidenceSourceDrawer
        open={true}
        onClose={vi.fn()}
        capabilities={{ enabled: true, maxSelectedSources: 10, supportedSchemes: ["https"], maxUrlLength: 2048 }}
        workspaceId={1}
        embeddingDeploymentId="embedding-default"
        value={[]}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText("공개 HTTPS URL")).toBeDefined();
  });

  it("allows selecting workspace if workspaces list is provided", () => {
    const onWorkspaceChange = vi.fn();
    const mockWorkspaces: WorkspaceRef[] = [
      { id: 1, name: "Workspace 1", slug: "ws-1", path: "/ws-1", depth: 0, visibility: "PRIVATE", archived: false },
      { id: 2, name: "Workspace 2", slug: "ws-2", path: "/ws-2", depth: 0, visibility: "PRIVATE", archived: false },
    ];
    render(
      <RagEvidenceSourceDrawer
        open={true}
        onClose={vi.fn()}
        workspaceId={1}
        workspaces={mockWorkspaces}
        onWorkspaceChange={onWorkspaceChange}
        value={[]}
        onChange={vi.fn()}
      />
    );

    const select = screen.getByLabelText("웹 자료 workspace");
    expect(select).toBeDefined();
  });
});
