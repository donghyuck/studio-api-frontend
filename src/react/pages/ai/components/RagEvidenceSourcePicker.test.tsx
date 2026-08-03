// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RagEvidenceSourcePicker, mapWebErrorCodeToMessage } from "./RagEvidenceSourcePicker";

const { listWebKnowledgeSources, createWebKnowledgeSource, previewWebKnowledgeSource } = vi.hoisted(() => ({
  listWebKnowledgeSources: vi.fn(),
  createWebKnowledgeSource: vi.fn(),
  previewWebKnowledgeSource: vi.fn(),
}));

vi.mock("@/react/pages/ai/api", () => ({
  reactAiApi: {
    listWebKnowledgeSources,
    createWebKnowledgeSource,
    previewWebKnowledgeSource,
    refreshWebKnowledgeSource: vi.fn(),
    cancelWebKnowledgeSource: vi.fn(),
    archiveWebKnowledgeSource: vi.fn(),
    listCrawlRuns: vi.fn().mockResolvedValue([]),
    listPages: vi.fn().mockResolvedValue([]),
    updateCrawlPolicy: vi.fn(),
  },
}));

describe("RagEvidenceSourcePicker", () => {
  beforeEach(() => {
    listWebKnowledgeSources.mockReset();
    createWebKnowledgeSource.mockReset();
    previewWebKnowledgeSource.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("maps error codes to friendly Korean messages", () => {
    expect(mapWebErrorCodeToMessage("WEB_SOURCE_EMBEDDING_SPACE_MISMATCH")).toContain("선택한 임베딩 모델과 호환되지 않는 웹 자료입니다");
    expect(mapWebErrorCodeToMessage("WEB_SITE_CRAWL_DISABLED")).toContain("사이트 수집 기능이 비활성화되어 있습니다");
    expect(mapWebErrorCodeToMessage("WEB_CRAWL_QUOTA_EXCEEDED")).toContain("workspace 수집 한도(quota)를 초과하였습니다");
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
        collectionMode: "SITE",
        currentCorpusRevisionId: "wcorpus-ready",
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
        { sourceId: "wsrc-ready", corpusRevisionId: "wcorpus-ready", revisionId: undefined },
      ])
    );
  });

  it("shows SITE options when siteCrawlEnabled is true", async () => {
    listWebKnowledgeSources.mockResolvedValue([]);

    render(
      <RagEvidenceSourcePicker
        workspaceId={2}
        embeddingDeploymentId="embedding-default"
        capabilities={{
          enabled: true,
          siteCrawlEnabled: true,
          maxSelectedSources: 10,
          supportedSchemes: ["https"],
          maxUrlLength: 2048,
          defaultMaxDepth: 2,
          defaultMaxPages: 50,
        }}
        value={[]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText("수집 범위 설정")).toBeDefined();
    expect(screen.getByText(/하위 페이지 포함/i)).toBeDefined();
  });

  it("triggers preview and opens preview modal on SITE preview click", async () => {
    listWebKnowledgeSources.mockResolvedValue([]);
    previewWebKnowledgeSource.mockResolvedValue({
      rootUrl: "https://example.org/docs/",
      effectivePolicy: {
        scope: "PATH_PREFIX",
        discoveryMode: "SITEMAP_AND_LINKS",
        maxDepth: 2,
        maxPages: 50,
        maxConcurrency: 2,
        minDelayPerOriginMillis: 500,
        dropAllQuery: true,
        includePathGlobs: [],
        excludePathGlobs: [],
        allowedQueryKeys: [],
      },
      candidateCount: 5,
      candidates: [{ url: "https://example.org/docs/a", host: "example.org", path: "/docs/a", depth: 1 }],
      excludedCount: 1,
      excludedSamples: [{ host: "example.org", path: "/admin", reasonCode: "SCOPE_MISMATCH" }],
      queryParametersRemovedCount: 2,
      truncated: false,
      warnings: [],
    });

    render(
      <RagEvidenceSourcePicker
        workspaceId={2}
        embeddingDeploymentId="embedding-default"
        capabilities={{
          enabled: true,
          siteCrawlEnabled: true,
          maxSelectedSources: 10,
          supportedSchemes: ["https"],
          maxUrlLength: 2048,
        }}
        value={[]}
        onChange={vi.fn()}
      />
    );

    // Select SITE mode
    const siteRadio = screen.getByText(/하위 페이지 포함/i);
    fireEvent.click(siteRadio);

    const input = screen.getByLabelText("공개 HTTPS URL");
    fireEvent.change(input, { target: { value: "https://example.org/docs/" } });

    const previewBtn = screen.getByRole("button", { name: "미리보기" });
    fireEvent.click(previewBtn);

    await screen.findByText("사이트 수집 범위 미리보기 (Preview)");
    expect(screen.getByText(/PREVIEW_FIRST_HOP_ONLY/)).toBeDefined();
    expect(screen.getByText(/예상 후보 페이지: 5개/)).toBeDefined();
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

    const link = await screen.findByText("https://example.org/link");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
