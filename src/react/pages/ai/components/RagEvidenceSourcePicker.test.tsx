// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RagEvidenceSourcePicker, mapWebErrorCodeToMessage } from "./RagEvidenceSourcePicker";

const { listWebKnowledgeSources, createWebKnowledgeSource, previewWebKnowledgeSource, listCrawlRuns, listPages, getPage } = vi.hoisted(() => ({
  listWebKnowledgeSources: vi.fn(),
  createWebKnowledgeSource: vi.fn(),
  previewWebKnowledgeSource: vi.fn(),
  listCrawlRuns: vi.fn(),
  listPages: vi.fn(),
  getPage: vi.fn(),
}));

vi.mock("@/react/pages/ai/api", () => ({
  reactAiApi: {
    listWebKnowledgeSources,
    createWebKnowledgeSource,
    previewWebKnowledgeSource,
    refreshWebKnowledgeSource: vi.fn(),
    cancelWebKnowledgeSource: vi.fn(),
    archiveWebKnowledgeSource: vi.fn(),
    listCrawlRuns,
    listPages,
    getPage,
    updateCrawlPolicy: vi.fn(),
  },
}));

vi.mock("@/react/components/ag-grid", () => ({
  GridContent: ({ rowData }: { rowData: Array<{ runId?: string }> }) => (
    <div data-testid="crawl-run-grid">{rowData.map((row) => row.runId).join(",")}</div>
  ),
}));

describe("RagEvidenceSourcePicker", () => {
  beforeEach(() => {
    listWebKnowledgeSources.mockReset();
    createWebKnowledgeSource.mockReset();
    previewWebKnowledgeSource.mockReset();
    listCrawlRuns.mockReset();
    listPages.mockReset();
    getPage.mockReset();
    listCrawlRuns.mockResolvedValue([]);
    listPages.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it("maps error codes to friendly Korean messages", () => {
    expect(mapWebErrorCodeToMessage("WEB_SOURCE_EMBEDDING_SPACE_MISMATCH")).toContain("선택한 임베딩 모델과 호환되지 않는 웹 자료입니다");
    expect(mapWebErrorCodeToMessage("WEB_SITE_CRAWL_DISABLED")).toContain("사이트 수집 기능이 비활성화되어 있습니다");
    expect(mapWebErrorCodeToMessage("WEB_CRAWL_QUOTA_EXCEEDED")).toContain("workspace 수집 한도(quota)를 초과하였습니다");
  });

  it("loads every deployment when used by the Workspace URL manager", async () => {
    listWebKnowledgeSources.mockResolvedValue([]);

    render(
      <RagEvidenceSourcePicker
        workspaceId={2}
        embeddingDeploymentId="humanities-text-v1"
        value={[]}
        managementOnly
        listAllDeployments
        onChange={vi.fn()}
      />
    );

    await waitFor(() => expect(listWebKnowledgeSources).toHaveBeenCalledWith(2, undefined));
  });

  it("opens collected page detail from the Workspace URL manager", async () => {
    listWebKnowledgeSources.mockResolvedValue([{
      sourceId: "source-1",
      workspaceId: 2,
      url: "https://example.org/docs",
      host: "example.org",
      displayName: "문서 사이트",
      embeddingDeploymentId: "humanities-text-v1",
      status: "COMPLETED",
      collectionMode: "SITE",
      currentCorpusRevisionId: "corpus-1",
    }]);
    listCrawlRuns.mockResolvedValue([]);
    listPages.mockResolvedValue([{
      pageId: "page-1",
      url: "https://example.org/docs/page",
      host: "example.org",
      path: "/docs/page",
      title: "수집 페이지",
      status: "ACTIVE",
      active: true,
      missingRunCount: 0,
    }]);
    getPage.mockResolvedValue({
      pageId: "page-1",
      workspaceId: 2,
      sourceId: "source-1",
      url: "https://example.org/docs/page",
      host: "example.org",
      path: "/docs/page",
      title: "수집 페이지",
      status: "ACTIVE",
      active: true,
      missingRunCount: 0,
      pageRevisionId: "revision-1",
      revisionStatus: "COMPLETED",
      contentType: "text/html",
      contentLength: 1234,
      contentPreview: "페이지 본문 미리보기",
      metadataJson: "x".repeat(16_384),
      metadataTruncated: true,
    });

    render(
      <RagEvidenceSourcePicker
        workspaceId={2}
        embeddingDeploymentId="humanities-text-v1"
        value={[]}
        managementOnly
        listAllDeployments
        onChange={vi.fn()}
      />
    );

    await screen.findByText("문서 사이트");
    fireEvent.click(screen.getByText("https://example.org/docs"));
    fireEvent.click(await screen.findByText("수집 페이지 목록 (Pages)"));
    await screen.findByText("수집 페이지");
    fireEvent.click(screen.getByRole("button", { name: "상세" }));

    expect(await screen.findByText("수집 페이지 상세")).toBeDefined();
    expect(await screen.findByText("페이지 본문 미리보기")).toBeDefined();
    expect(await screen.findByText("큰 메타데이터이므로 앞부분만 표시합니다.")).toBeDefined();
    expect(getPage).toHaveBeenCalledWith(2, "source-1", "page-1");
  });

  it("keeps source policy read-only in the Document Q&A selector", async () => {
    listWebKnowledgeSources.mockResolvedValue([{
      sourceId: "source-read-only",
      workspaceId: 2,
      url: "https://example.org/read-only",
      host: "example.org",
      displayName: "읽기 전용 사이트",
      embeddingDeploymentId: "humanities-text-v1",
      status: "COMPLETED",
      collectionMode: "SITE",
      currentCorpusRevisionId: "corpus-read-only",
    }]);

    render(
      <RagEvidenceSourcePicker
        workspaceId={2}
        embeddingDeploymentId="humanities-text-v1"
        value={[]}
        selectionOnly
        onChange={vi.fn()}
      />
    );

    fireEvent.click(await screen.findByText("https://example.org/read-only"));

    expect(await screen.findByRole("heading", { name: "읽기 전용 사이트" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "수집 정책 변경 및 재수집 시작" })).toBeNull();
  });

  it("shows an error when crawl history or collected pages cannot be loaded", async () => {
    listWebKnowledgeSources.mockResolvedValue([{
      sourceId: "source-load-error",
      workspaceId: 2,
      url: "https://example.org/load-error",
      host: "example.org",
      displayName: "조회 오류 사이트",
      embeddingDeploymentId: "humanities-text-v1",
      status: "COMPLETED",
      collectionMode: "SITE",
      currentCorpusRevisionId: "corpus-load-error",
    }]);
    listPages.mockRejectedValue(new Error("페이지 목록 조회 실패"));

    render(
      <RagEvidenceSourcePicker
        workspaceId={2}
        embeddingDeploymentId="humanities-text-v1"
        value={[]}
        managementOnly
        onChange={vi.fn()}
      />
    );

    fireEvent.click(await screen.findByText("https://example.org/load-error"));

    expect(await screen.findByText("페이지 목록 조회 실패")).toBeDefined();
  });

  it("closes source detail when the Workspace scope changes", async () => {
    listWebKnowledgeSources.mockResolvedValue([{
      sourceId: "source-workspace-change",
      workspaceId: 2,
      url: "https://example.org/workspace-change",
      host: "example.org",
      displayName: "Workspace 변경 사이트",
      embeddingDeploymentId: "humanities-text-v1",
      status: "COMPLETED",
      collectionMode: "SITE",
      currentCorpusRevisionId: "corpus-workspace-change",
    }]);

    const { rerender } = render(
      <RagEvidenceSourcePicker
        workspaceId={2}
        embeddingDeploymentId="humanities-text-v1"
        value={[]}
        managementOnly
        onChange={vi.fn()}
      />
    );

    fireEvent.click(await screen.findByText("https://example.org/workspace-change"));
    expect(await screen.findByRole("heading", { name: "Workspace 변경 사이트" })).toBeDefined();

    rerender(
      <RagEvidenceSourcePicker
        workspaceId={3}
        embeddingDeploymentId="humanities-text-v1"
        value={[]}
        managementOnly
        onChange={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.queryByRole("heading", { name: "Workspace 변경 사이트" })).toBeNull());
  });

  it("renders crawl run history through the shared AG Grid", async () => {
    listWebKnowledgeSources.mockResolvedValue([{
      sourceId: "source-grid",
      workspaceId: 2,
      url: "https://example.org/grid",
      host: "example.org",
      displayName: "Grid 사이트",
      embeddingDeploymentId: "humanities-text-v1",
      status: "COMPLETED",
      collectionMode: "SITE",
      currentCorpusRevisionId: "corpus-grid",
    }]);
    listCrawlRuns.mockResolvedValue([{
      runId: "run-grid-1",
      status: "COMPLETED",
      discoveredCount: 9,
      fetchedCount: 9,
      indexedCount: 9,
      unchangedCount: 0,
      updatedCount: 9,
      removedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      responseBytes: 1000,
      normalizedChars: 500,
      truncated: false,
      createdAt: "2026-08-31T00:00:00Z",
      updatedAt: "2026-08-31T00:00:01Z",
    }]);

    render(
      <RagEvidenceSourcePicker
        workspaceId={2}
        embeddingDeploymentId="humanities-text-v1"
        value={[]}
        managementOnly
        listAllDeployments
        onChange={vi.fn()}
      />
    );

    await screen.findByText("Grid 사이트");
    fireEvent.click(screen.getByText("옵션 수정"));

    expect((await screen.findByTestId("crawl-run-grid")).textContent).toContain("run-grid-1");
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

  it("initializes the SITE policy editor from the saved source policy", async () => {
    listWebKnowledgeSources.mockResolvedValue([
      {
        sourceId: "wsrc-site-policy",
        workspaceId: 2,
        url: "https://example.org/docs/",
        host: "example.org",
        displayName: "저장 정책 자료",
        embeddingDeploymentId: "embedding-default",
        status: "COMPLETED",
        collectionMode: "SITE",
        currentCorpusRevisionId: "wcorpus-policy",
        crawlPolicy: {
          scope: "SAME_ORIGIN",
          discoveryMode: "LINKS_ONLY",
          maxDepth: 1,
          maxPages: 10,
          maxConcurrency: 2,
          minDelayPerOriginMillis: 500,
          dropAllQuery: true,
          includePathGlobs: ["/docs/**", "/guide/**"],
          excludePathGlobs: ["/archive/**"],
          allowedQueryKeys: [],
          policyVersion: "web-crawl-policy-v1",
        },
        createdAt: "2026-08-03T00:00:00Z",
        updatedAt: "2026-08-03T00:00:00Z",
      },
    ]);

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

    await screen.findByText("저장 정책 자료");
    fireEvent.click(screen.getByRole("button", { name: "옵션 수정" }));

    expect((await screen.findByLabelText("최대 깊이") as HTMLInputElement).value).toBe("1");
    expect((screen.getByLabelText("최대 페이지 수") as HTMLInputElement).value).toBe("10");
    const includeInputs = screen.getAllByLabelText(/포함 패턴/);
    const excludeInputs = screen.getAllByLabelText(/제외 패턴/);
    expect((includeInputs.at(-1) as HTMLInputElement).value).toBe("/docs/**, /guide/**");
    expect((excludeInputs.at(-1) as HTMLInputElement).value).toBe("/archive/**");
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

  it("opens source options from the URL and keeps the external link inside the dialog", async () => {
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

    fireEvent.click(await screen.findByText("https://example.org/link"));

    expect(await screen.findByRole("heading", { name: "링크 자료" })).toBeDefined();
    const link = screen.getByRole("link", { name: "https://example.org/link · 원문 URL 열기" });
    expect(link.getAttribute("href")).toBe("https://example.org/link");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
