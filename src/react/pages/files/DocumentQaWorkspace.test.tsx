// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import type {
  DocumentQuestionSuggestionStatus,
  DocumentQuestionSuggestionsResponseDto,
} from "@/types/studio/ai";
import { DocumentQaWorkspace } from "./DocumentQaWorkspace";

function renderWorkspaceProps(
  overrides: Partial<ComponentProps<typeof DocumentQaWorkspace>> = {}
): ComponentProps<typeof DocumentQaWorkspace> {
  return {
    fileName: "report.pdf",
    messages: [],
    sending: false,
    error: null,
    input: "",
    selectedWebSourcesCount: 2,
    settingsLabel: "gemini-2.5-flash",
    settingsContent: <div>설정 내용</div>,
    questionSuggestions: null,
    questionSuggestionsLoading: false,
    questionSuggestionsError: null,
    onInputChange: vi.fn(),
    onSelectSuggestedQuestion: vi.fn(),
    onRetryQuestionSuggestions: vi.fn(),
    onSubmit: vi.fn(),
    onOpenSources: vi.fn(),
    onCopy: vi.fn(),
    onEditUser: vi.fn(),
    onRegenerate: vi.fn(),
    onRetryLastUser: vi.fn(),
    ...overrides,
  };
}

function renderWorkspace(overrides: Partial<ComponentProps<typeof DocumentQaWorkspace>> = {}) {
  const props = renderWorkspaceProps(overrides);
  render(<DocumentQaWorkspace {...props} />);
  return props;
}

function suggestionResponse(
  status: DocumentQuestionSuggestionStatus
): DocumentQuestionSuggestionsResponseDto {
  return {
    contractVersion: "rag-question-suggestions-v1",
    generatedAt: "2026-08-14T00:00:00Z",
    basis: {
      objectType: "attachment",
      objectId: "19",
      documentId: "document-19",
      revisionId: "revision-2",
      sourceContentHash: "hash-19",
      chunkSetId: "chunks-19",
    },
    availability: { status, reasonCodes: [] },
    suggestions: [],
    policy: {
      version: "rag-question-suggestions-v1",
      fingerprint: "sha256:test",
      maxSuggestions: 3,
    },
  };
}

describe("DocumentQaWorkspace", () => {
  afterEach(() => cleanup());

  it("keeps document context and response settings in one compact composer", () => {
    const props = renderWorkspace();

    expect(screen.getByText("이 문서에서 무엇을 찾을까요?")).toBeDefined();
    expect(screen.getByText("추가 자료 2")).toBeDefined();
    expect(screen.getByText("gemini-2.5-flash")).toBeDefined();
    expect(screen.queryByText("설정 내용")).toBeNull();

    fireEvent.click(screen.getByText("추가 자료 2"));
    expect(props.onOpenSources).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("gemini-2.5-flash"));
    expect(screen.getByText("설정 내용")).toBeDefined();
  });

  it("submits the exact server suggested question and submits the composer with Enter", () => {
    const onSelectSuggestedQuestion = vi.fn();
    const onSubmit = vi.fn();
    renderWorkspace({
      input: "문서 질문",
      onSelectSuggestedQuestion,
      onSubmit,
      questionSuggestions: {
        ...suggestionResponse("AVAILABLE"),
        suggestions: [{
          id: "qs-1",
          query: "문서에서 '펠로폰네소스 전쟁'의 핵심 의미를 설명해줘",
          type: "KEYWORD_EXPLANATION",
          keywords: ["펠로폰네소스 전쟁"],
          source: "DOCUMENT_KEYWORDS",
        }],
      },
    });

    const query = "문서에서 '펠로폰네소스 전쟁'의 핵심 의미를 설명해줘";
    fireEvent.click(screen.getByText(query));
    expect(onSelectSuggestedQuestion).toHaveBeenCalledWith(query);

    const input = screen.getByRole("textbox", { name: "문서 질문" });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("distinguishes loading, not-ready, no-signal, and failure states without fixed fallback questions", () => {
    const { rerender } = render(
      <DocumentQaWorkspace
        {...renderWorkspaceProps({ questionSuggestionsLoading: true })}
      />
    );
    expect(screen.getByText("문서에 맞는 질문을 준비하는 중...")).toBeDefined();
    expect(screen.queryByText("이 문서의 핵심 내용을 요약해줘")).toBeNull();

    rerender(<DocumentQaWorkspace {...renderWorkspaceProps({
      questionSuggestions: suggestionResponse("NOT_READY"),
    })} />);
    expect(screen.getByText("문서 색인이 준비되면 추천 질문을 표시합니다.")).toBeDefined();

    rerender(<DocumentQaWorkspace {...renderWorkspaceProps({
      questionSuggestions: suggestionResponse("NO_SIGNALS"),
    })} />);
    expect(screen.getByText("추천할 질문을 찾지 못했습니다. 직접 질문해 주세요.")).toBeDefined();

    const onRetryQuestionSuggestions = vi.fn();
    rerender(<DocumentQaWorkspace {...renderWorkspaceProps({
      questionSuggestionsError: "서버 오류",
      onRetryQuestionSuggestions,
    })} />);
    fireEvent.click(screen.getByRole("button", { name: "추천 질문 다시 시도" }));
    expect(onRetryQuestionSuggestions).toHaveBeenCalledTimes(1);
  });

  it("shows a retry action without adding a duplicate error message", () => {
    const onRegenerate = vi.fn();
    renderWorkspace({ error: "검색 요청에 실패했습니다.", onRegenerate });

    expect(screen.getByText("검색 요청에 실패했습니다.")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("collapses repeated server policy badges into one evidence badge", () => {
    renderWorkspace({
      messages: [
        {
          id: "assistant-1",
          role: "assistant",
          content: "문서 답변입니다.",
          metadata: {
            canonicalContent: "문서 답변입니다.",
            answerPolicy: { effectiveMode: "STRICT_GROUNDED" },
            sourcePolicy: { effectiveScope: "DOCUMENT_ONLY" },
            answerPresentation: { effectivePreference: "AUTO" },
          } as any,
        },
      ],
    });

    expect(screen.getByText("문서 근거")).toBeDefined();
    expect(screen.queryByText("첨부 문서만")).toBeNull();
    expect(screen.queryByText("자동 구성")).toBeNull();
  });
});
