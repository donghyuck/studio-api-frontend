// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchRagCapabilities, getEmbeddingOptions } = vi.hoisted(() => ({
  fetchRagCapabilities: vi.fn(),
  getEmbeddingOptions: vi.fn(),
}));

vi.mock("@/react/pages/ai/api", () => ({
  reactAiApi: { fetchRagCapabilities, getEmbeddingOptions },
}));

vi.mock("@/react/pages/ai/components/RagEvidenceSourcePicker", () => ({
  RagEvidenceSourcePicker: (props: {
    workspaceId: number;
    embeddingDeploymentId: string;
    managementOnly?: boolean;
    listAllDeployments?: boolean;
    disabled?: boolean;
  }) => (
    <div data-testid="url-manager">
      {`${props.workspaceId}|${props.embeddingDeploymentId}|${props.managementOnly}|${props.listAllDeployments}|${props.disabled}`}
    </div>
  ),
}));

import { WorkspaceUrlSourcesPanel } from "@/react/pages/workspaces/WorkspaceUrlSourcesPanel";

describe("WorkspaceUrlSourcesPanel", () => {
  beforeEach(() => {
    fetchRagCapabilities.mockResolvedValue({
      indexedWeb: { enabled: true, maxSelectedSources: 10 },
    });
    getEmbeddingOptions.mockResolvedValue({
      options: [{
        deploymentId: "humanities-text-v1",
        defaultProfile: true,
        defaultProvider: true,
      }],
    });
  });
  afterEach(() => cleanup());

  it("loads the default embedding deployment and opens URL management mode", async () => {
    render(<WorkspaceUrlSourcesPanel workspaceId={11} disabled />);

    expect((await screen.findByTestId("url-manager")).textContent)
      .toContain("11|humanities-text-v1|true|true|true");
  });
});
