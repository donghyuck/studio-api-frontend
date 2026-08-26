// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownViewerDialog } from "./MarkdownViewerDialog";

const getResources = vi.fn();
const getLocators = vi.fn();
const getProvenance = vi.fn();
const getProgress = vi.fn();
const getMetadataSummary = vi.fn();
const reextractMetadata = vi.fn();
const translateMetadataSummary = vi.fn();
const downloadMarkdown = vi.fn();
const invalidateQueries = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
  useQuery: () => ({
    data: null,
    error: null,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useQueryClient: () => ({ invalidateQueries }),
}));

vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value }: { value: string }) => <div data-testid="codemirror">{value}</div>,
}));

vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));

vi.mock("@/react/auth/store", () => ({
  useAuthStore: {
    getState: () => ({ token: null }),
  },
}));

vi.mock("@/react/feedback", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/react/pages/ai/api", () => ({
  reactAiApi: {
    getRagObjectUsability: vi.fn(),
    runRagObjectAutoEvaluation: vi.fn(),
  },
}));

vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return {
    ...actual,
    reactMarkdownDocumentApi: {
      getResources: (...args: unknown[]) => getResources(...args),
      getLocators: (...args: unknown[]) => getLocators(...args),
      getProvenance: (...args: unknown[]) => getProvenance(...args),
      getProgress: (...args: unknown[]) => getProgress(...args),
      getMetadataSummary: (...args: unknown[]) => getMetadataSummary(...args),
      reextractMetadata: (...args: unknown[]) => reextractMetadata(...args),
      translateMetadataSummary: (...args: unknown[]) => translateMetadataSummary(...args),
      downloadMarkdown: (...args: unknown[]) => downloadMarkdown(...args),
    },
  };
});

vi.mock("./DocumentUsabilityPanel", () => ({
  DocumentUsabilityPanel: () => <div>usability</div>,
}));

vi.mock("./documentUsabilityView", () => ({
  shouldPollUsability: () => false,
}));

function renderDialog(open = true) {
  return render(
    <MarkdownViewerDialog
      open={open}
      onClose={vi.fn()}
      attachmentId={19}
      documentId="mdoc-19"
      revisionId="mrev-2"
      fileName="report.pdf"
    />
  );
}

describe("MarkdownViewerDialog metadata boundaries", () => {
  beforeEach(() => {
    getResources.mockResolvedValue([]);
    getLocators.mockResolvedValue([]);
    getProvenance.mockResolvedValue([]);
    getProgress.mockResolvedValue(null);
    getMetadataSummary.mockResolvedValue({
      documentId: "mdoc-19",
      revisionId: "mrev-2",
      artifactId: "metadata:mrev-2",
      semanticType: "REPORT",
      subject: null,
      confidence: 0.9,
      language: "en",
      title: "Report",
      authors: [],
      publicationYear: null,
      organization: null,
      summary: "Summary",
      keywords: ["policy"],
      quality: "COMPLETE",
      warnings: [],
    });
    reextractMetadata.mockResolvedValue({});
    translateMetadataSummary.mockResolvedValue({
      translationId: "translation:mrev-2:ko",
      revisionId: "mrev-2",
      sourceArtifactId: "metadata:mrev-2",
      sourceSummaryHash: "sha256:test",
      sourceLanguage: "en",
      targetLanguage: "ko",
      summary: "한국어 요약",
      keywords: ["정책", "보고서"],
      generationMode: "TRANSLATED",
      model: "gemini-test",
      promptVersion: "document-metadata-translation-v1",
      createdAt: "2026-08-20T00:00:00Z",
      reused: false,
    });
    downloadMarkdown.mockResolvedValue(undefined);
    invalidateQueries.mockResolvedValue(undefined);
    global.confirm = vi.fn(() => true);
    global.fetch = vi.fn().mockResolvedValue(
      new Response("# title", {
        status: 200,
        headers: { "content-type": "text/markdown;charset=UTF-8" },
      })
    ) as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps metadata endpoints idle while opened on the markdown tab", async () => {
    renderDialog();

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    expect(getResources).not.toHaveBeenCalled();
    expect(getLocators).not.toHaveBeenCalled();
    expect(getProgress).not.toHaveBeenCalled();
    expect(getMetadataSummary).not.toHaveBeenCalled();
    expect(getProvenance).not.toHaveBeenCalled();
  });

  it("loads a compact summary first and defers cached raw details until requested", async () => {
    renderDialog();

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("tab", { name: "Metadata" }));

    await waitFor(() => {
      expect(getMetadataSummary).toHaveBeenCalledTimes(1);
      expect(getMetadataSummary).toHaveBeenCalledWith("mdoc-19", "mrev-2");
      expect(getProgress).toHaveBeenCalledTimes(1);
      expect(getProgress).toHaveBeenCalledWith("mdoc-19", "mrev-2");
    });
    expect(getResources).not.toHaveBeenCalled();
    expect(getLocators).not.toHaveBeenCalled();
    expect(getProvenance).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "상세 데이터 불러오기" }));
    await waitFor(() => {
      expect(getResources).toHaveBeenCalledTimes(1);
      expect(getResources).toHaveBeenCalledWith("mdoc-19", "mrev-2");
      expect(getLocators).toHaveBeenCalledTimes(1);
      expect(getLocators).toHaveBeenCalledWith("mdoc-19", "mrev-2");
    });

    fireEvent.click(screen.getByRole("tab", { name: "Markdown" }));
    fireEvent.click(screen.getByRole("tab", { name: "Metadata" }));

    await waitFor(() => {
      expect(getMetadataSummary).toHaveBeenCalledTimes(1);
      expect(getProgress).toHaveBeenCalledTimes(1);
      expect(getResources).toHaveBeenCalledTimes(1);
      expect(getLocators).toHaveBeenCalledTimes(1);
    });
    expect(getProvenance).not.toHaveBeenCalled();
  });

  it("allows the document metadata summary to be collapsed and expanded", async () => {
    renderDialog();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("tab", { name: "Metadata" }));
    await screen.findByText("Summary");

    const summaryToggle = screen.getByRole("button", { name: "문서 메타데이터 요약 접기" });
    expect(summaryToggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("접기")).toBeTruthy();

    fireEvent.click(summaryToggle);
    expect(summaryToggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("button", { name: "문서 메타데이터 요약 펼치기" })).toBeTruthy();
    expect(screen.getByText("펼치기")).toBeTruthy();

    fireEvent.click(summaryToggle);
    expect(summaryToggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("reextracts metadata for the current revision and reloads the summary", async () => {
    renderDialog();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("tab", { name: "Metadata" }));
    await screen.findByText("Summary");
    fireEvent.click(screen.getByRole("button", { name: "요약 재추출" }));

    expect(global.confirm).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(reextractMetadata).toHaveBeenCalledWith("mdoc-19", "mrev-2");
      expect(getMetadataSummary).toHaveBeenCalledTimes(2);
    });
  });

  it("translates a non-Korean summary once and toggles between Korean and the source", async () => {
    renderDialog();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("tab", { name: "Metadata" }));
    await screen.findByText("Summary");
    fireEvent.click(screen.getByRole("button", { name: "한국어로 보기" }));

    expect(global.confirm).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(translateMetadataSummary).toHaveBeenCalledWith("mdoc-19", "mrev-2", "ko");
      expect(screen.getByText("한국어 요약")).toBeTruthy();
      expect(screen.getByText("한국어 번역")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "원문으로 보기" }));
    expect(screen.getByText("Summary")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "한국어로 보기" }));
    await screen.findByText("한국어 요약");
    expect(translateMetadataSummary).toHaveBeenCalledTimes(1);
  });

  it("does not offer translation when the source summary is Korean", async () => {
    getMetadataSummary.mockResolvedValueOnce({
      documentId: "mdoc-19",
      revisionId: "mrev-2",
      artifactId: "metadata:mrev-2",
      semanticType: "REPORT",
      subject: null,
      confidence: 0.9,
      language: "ko",
      title: "보고서",
      authors: [],
      publicationYear: null,
      organization: null,
      summary: "한국어로 작성된 요약입니다.",
      keywords: ["정책"],
      quality: "COMPLETE",
      warnings: [],
    });
    renderDialog();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("tab", { name: "Metadata" }));
    await screen.findByText("한국어로 작성된 요약입니다.");

    expect(screen.queryByRole("button", { name: "한국어로 보기" })).toBeNull();
    expect(translateMetadataSummary).not.toHaveBeenCalled();
  });

  it("keeps the source summary visible and does not retry a failed translation", async () => {
    translateMetadataSummary.mockRejectedValueOnce(new Error("translation unavailable"));
    renderDialog();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("tab", { name: "Metadata" }));
    await screen.findByText("Summary");
    fireEvent.click(screen.getByRole("button", { name: "한국어로 보기" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "한국어로 보기" }).hasAttribute("disabled")).toBe(false));
    expect(screen.getByText("Summary")).toBeTruthy();
    expect(translateMetadataSummary).toHaveBeenCalledTimes(1);
  });

  it("does not automatically retry a failed metadata regeneration", async () => {
    reextractMetadata.mockRejectedValueOnce(new Error("model unavailable"));
    renderDialog();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("tab", { name: "Metadata" }));
    await screen.findByText("Summary");
    fireEvent.click(screen.getByRole("button", { name: "요약 재추출" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "요약 재추출" }).hasAttribute("disabled")).toBe(false));
    expect(reextractMetadata).toHaveBeenCalledTimes(1);
  });

  it("ignores a completed regeneration after the dialog moves to another revision", async () => {
    let finishRegeneration: (() => void) | undefined;
    reextractMetadata.mockReturnValueOnce(new Promise<void>((resolve) => {
      finishRegeneration = resolve;
    }));
    const { rerender } = renderDialog();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("tab", { name: "Metadata" }));
    await screen.findByText("Summary");
    fireEvent.click(screen.getByRole("button", { name: "요약 재추출" }));
    await waitFor(() => expect(reextractMetadata).toHaveBeenCalledWith("mdoc-19", "mrev-2"));

    rerender(
      <MarkdownViewerDialog
        open
        onClose={vi.fn()}
        attachmentId={20}
        documentId="mdoc-20"
        revisionId="mrev-3"
        fileName="next.pdf"
      />
    );
    await waitFor(() => expect(screen.getByRole("tab", { name: "Markdown" }).getAttribute("aria-selected")).toBe("true"));
    const callsBeforeCompletion = getMetadataSummary.mock.calls.length;
    await act(async () => finishRegeneration?.());
    expect(getMetadataSummary).toHaveBeenCalledTimes(callsBeforeCompletion);
  });

  it("retries detailed metadata with a forced reload after an error", async () => {
    getResources.mockRejectedValueOnce(new Error("boom"));

    renderDialog();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("tab", { name: "Metadata" }));
    await waitFor(() => expect(getMetadataSummary).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "상세 데이터 불러오기" }));

    expect(await screen.findByText(/상세 메타데이터를 불러오지 못했습니다: boom/)).toBeTruthy();
    expect(getResources).toHaveBeenCalledTimes(1);
    expect(getLocators).toHaveBeenCalledTimes(1);
    expect(getProgress).toHaveBeenCalledTimes(1);
    expect(getProvenance).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    await waitFor(() => {
      expect(getResources).toHaveBeenCalledTimes(2);
      expect(getLocators).toHaveBeenCalledTimes(2);
      expect(getProgress).toHaveBeenCalledTimes(1);
    });
    expect(getProvenance).not.toHaveBeenCalled();
  });

  it("resets to the markdown tab on reopen without metadata prefetch for the same document", async () => {
    const { rerender } = renderDialog();

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("tab", { name: "Metadata" }));
    await waitFor(() => expect(getMetadataSummary).toHaveBeenCalledTimes(1));

    rerender(
      <MarkdownViewerDialog
        open={false}
        onClose={vi.fn()}
        attachmentId={19}
        documentId="mdoc-19"
        revisionId="mrev-2"
        fileName="report.pdf"
      />
    );

    rerender(
      <MarkdownViewerDialog
        open={true}
        onClose={vi.fn()}
        attachmentId={19}
        documentId="mdoc-19"
        revisionId="mrev-2"
        fileName="report.pdf"
      />
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("tab", { name: "Markdown" }).getAttribute("aria-selected")).toBe("true");
    expect(getMetadataSummary).toHaveBeenCalledTimes(1);
    expect(getResources).not.toHaveBeenCalled();
    expect(getLocators).not.toHaveBeenCalled();
    expect(getProgress).toHaveBeenCalledTimes(1);
    expect(getProvenance).not.toHaveBeenCalled();
  });
});
