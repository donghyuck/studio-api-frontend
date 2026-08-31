// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { DocumentUsabilityAssessmentDto, RagMeasuredValueDto } from "@/types/studio/ai";
import { DocumentUsabilityPanel } from "./DocumentUsabilityPanel";

function measured(value: number): RagMeasuredValueDto<number> {
  return { state: "MEASURED", value, reasonCode: null };
}

function notMeasured(reasonCode = "NOT_RUN"): RagMeasuredValueDto<number> {
  return { state: "NOT_MEASURED", value: null, reasonCode };
}

function assessment(overrides: Partial<DocumentUsabilityAssessmentDto> = {}): DocumentUsabilityAssessmentDto {
  const value: DocumentUsabilityAssessmentDto = {
    contractVersion: "document-usability-v1",
    evaluatedAt: "2026-08-10T00:00:00Z",
    basis: {
      objectType: "attachment",
      objectId: "17",
      documentId: "mdoc-1",
      revisionId: "mrev-1",
      sourceContentHash: "hash",
      chunkSetId: "chunks",
      indexJobId: "job",
      embeddingSpaceId: "space",
    },
    decision: { code: "AVAILABLE_WITH_REVIEW", usable: true, reasonCodes: ["LOW_SCORE_REVIEW"] },
    quality: {
      state: "MEASURED",
      status: "REVIEW_REQUIRED",
      score: measured(0.7),
      blocking: false,
      reasonCodes: ["LOW_SCORE_REVIEW"],
    },
    location: {
      state: "MEASURED",
      scheme: "PAGE_BBOX",
      coverage: measured(1),
      pageCoverage: measured(0),
      reasonCodes: [],
      samples: [],
    },
    indexing: {
      eligibility: { state: "MEASURED", status: "ELIGIBLE", reasonCodes: [] },
      execution: {
        state: "MEASURED",
        status: "SUCCEEDED",
        currentStep: null,
        progress: measured(1),
        chunkCount: measured(8),
        embeddedCount: measured(8),
        indexedCount: measured(8),
        reasonCodes: [],
      },
    },
    searchability: {
      state: "MEASURED",
      status: "SEARCHABLE",
      indexedRecordCount: measured(8),
      reasonCodes: [],
    },
    ragEvaluation: {
      state: "NOT_MEASURED",
      status: "NOT_RUN",
      freshness: "UNKNOWN",
      questionSetVersionId: null,
      runId: null,
      topK: null,
      selectedStrategy: null,
      evidenceHitRate: notMeasured("RAG_EVALUATION_NOT_RUN"),
      mrr: notMeasured("RAG_EVALUATION_NOT_RUN"),
      groundedAnswerRate: notMeasured("RAG_EVALUATION_NOT_RUN"),
      citationAccuracy: notMeasured("RAG_EVALUATION_NOT_RUN"),
      reasonCodes: ["RAG_EVALUATION_NOT_RUN"],
    },
    policy: { version: "policy-v1", fingerprint: "fingerprint" },
  };
  return { ...value, ...overrides };
}

describe("DocumentUsabilityPanel", () => {
  afterEach(() => cleanup());

  it("separates low quality, eligibility, execution, and searchability", () => {
    render(<DocumentUsabilityPanel assessment={assessment()} basisMatches evaluating={false} evaluationError={null} onAutoEvaluate={vi.fn()} />);

    expect(screen.getByText("사용 가능 · 검토 필요")).toBeDefined();
    expect(screen.getByText("품질 검토 필요")).toBeDefined();
    expect(screen.getByText("색인 가능")).toBeDefined();
    expect(screen.getByText("색인 완료")).toBeDefined();
    expect(screen.getByText("검색 가능")).toBeDefined();
    expect(screen.getByText("0.70")).toBeDefined();
    expect(screen.getByText("0.0%")).toBeDefined();
  });

  it("renders EPUB page coverage as not applicable without a zero progress value", () => {
    const epub = assessment({
      location: {
        ...assessment().location,
        scheme: "EPUB_RESOURCE_ELEMENT",
        pageCoverage: { state: "NOT_APPLICABLE", value: null, reasonCode: "PAGE_COVERAGE_NOT_APPLICABLE" },
      },
    });
    render(<DocumentUsabilityPanel assessment={epub} basisMatches evaluating={false} evaluationError={null} onAutoEvaluate={vi.fn()} />);

    expect(screen.getByText("EPUB 장·요소 위치 연결")).toBeDefined();
    expect(screen.getByText("이 파일 형식은 고정 페이지 기준을 사용하지 않습니다.")).toBeDefined();
    expect(screen.queryByText("페이지 위치 연결률")).toBeNull();
  });

  it("runs automatic evaluation only for a matching basis", () => {
    const onAutoEvaluate = vi.fn();
    const { rerender } = render(
      <DocumentUsabilityPanel assessment={assessment()} basisMatches evaluating={false} evaluationError={null} onAutoEvaluate={onAutoEvaluate} />
    );
    fireEvent.click(screen.getByRole("button", { name: "평가 실행" }));
    expect(onAutoEvaluate).toHaveBeenCalledTimes(1);

    rerender(
      <DocumentUsabilityPanel assessment={assessment()} basisMatches={false} evaluating={false} evaluationError={null} onAutoEvaluate={onAutoEvaluate} />
    );
    expect(screen.getByRole("button", { name: "평가 실행" })).toHaveProperty("disabled", true);
    const revisionWarning = screen.getByRole("alert");
    expect(revisionWarning.textContent).toContain("현재 리비전");
    expect(revisionWarning.textContent).toContain("자동 평가를 실행할 수 없습니다");
  });
});
