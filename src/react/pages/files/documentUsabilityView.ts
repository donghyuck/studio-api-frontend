import type {
  DocumentUsabilityAssessmentDto,
  RagMeasuredValueDto,
  RagMeasurementState,
} from "@/types/studio/ai";

export type UsabilityTone = "success" | "warning" | "error" | "info" | "default";

export type StatusView = {
  label: string;
  tone: UsabilityTone;
};

export type MeasurementView = {
  state: RagMeasurementState;
  label: string;
  measured: boolean;
  value: number | null;
  reasonCode: string | null;
};

const REASON_LABELS: Record<string, string> = {
  LOW_SCORE_REVIEW: "문서 품질 점수가 검토 기준에 해당합니다.",
  ANSWER_EVALUATION_NOT_RUN: "답변 평가는 아직 실행되지 않았습니다.",
  BLOCKING_QUALITY_FAILURE: "차단 수준의 문서 품질 문제가 있습니다.",
  EVALUATION_BASIS_STALE: "현재 문서 리비전보다 이전 평가 결과입니다.",
  EVALUATION_BASIS_UNVERIFIED: "평가 기준 리비전을 확인할 수 없습니다.",
  EVALUATION_RESULT_EMPTY: "자동 평가 결과가 비어 있습니다.",
  LOCATORS_NOT_FOUND: "원문 위치 정보가 생성되지 않았습니다.",
  NORMALIZED_SNAPSHOT_INVALID: "정규화 문서 정보를 읽을 수 없습니다.",
  NORMALIZED_SNAPSHOT_NOT_FOUND: "정규화 문서 정보가 아직 생성되지 않았습니다.",
  NO_BLOCKING_QUALITY_FAILURE: "색인을 차단하는 품질 문제는 없습니다.",
  PAGE_COVERAGE_NOT_APPLICABLE: "이 파일 형식은 고정 페이지 기준을 사용하지 않습니다.",
  QUALITY_SCORE_UNAVAILABLE: "문서 품질 점수가 측정되지 않았습니다.",
  QUALITY_STATUS_UNKNOWN: "문서 품질 상태를 확인할 수 없습니다.",
  RAG_EVALUATION_NOT_RUN: "자동 RAG 평가를 아직 실행하지 않았습니다.",
  RAG_INDEX_ELIGIBILITY_UNAVAILABLE: "RAG 색인 허용 여부가 측정되지 않았습니다.",
  VECTOR_METADATA_UNSUPPORTED: "현재 벡터 저장소에서 검색 상태 확인을 지원하지 않습니다.",
};

export function decisionView(code: string | null | undefined): StatusView {
  switch (code) {
    case "AVAILABLE":
      return { label: "사용 가능", tone: "success" };
    case "AVAILABLE_WITH_REVIEW":
      return { label: "사용 가능 · 검토 필요", tone: "warning" };
    case "PREPARING":
      return { label: "준비 중", tone: "info" };
    case "READY_FOR_INDEXING":
      return { label: "색인 준비 완료", tone: "info" };
    case "NOT_AVAILABLE":
      return { label: "사용 불가", tone: "error" };
    default:
      return { label: "상태 확인 필요", tone: "default" };
  }
}

export function qualityView(status: string | null | undefined): StatusView {
  switch (status) {
    case "PASSED":
      return { label: "품질 통과", tone: "success" };
    case "REVIEW_REQUIRED":
      return { label: "품질 검토 필요", tone: "warning" };
    case "FAILED":
      return { label: "품질 실패", tone: "error" };
    default:
      return { label: "품질 미확인", tone: "default" };
  }
}

export function eligibilityView(status: string | null | undefined): StatusView {
  switch (status) {
    case "ELIGIBLE":
      return { label: "색인 가능", tone: "success" };
    case "BLOCKED":
      return { label: "색인 차단", tone: "error" };
    default:
      return { label: "색인 허용 미확인", tone: "default" };
  }
}

export function executionView(status: string | null | undefined): StatusView {
  switch (status) {
    case "PENDING":
      return { label: "색인 대기", tone: "info" };
    case "RUNNING":
      return { label: "색인 진행 중", tone: "info" };
    case "SUCCEEDED":
      return { label: "색인 완료", tone: "success" };
    case "WARNING":
      return { label: "색인 완료 · 경고", tone: "warning" };
    case "FAILED":
      return { label: "색인 실패", tone: "error" };
    case "CANCELLED":
      return { label: "색인 취소", tone: "warning" };
    default:
      return { label: "색인 미실행", tone: "default" };
  }
}

export function searchabilityView(status: string | null | undefined): StatusView {
  switch (status) {
    case "SEARCHABLE":
      return { label: "검색 가능", tone: "success" };
    case "NOT_SEARCHABLE":
      return { label: "검색 불가", tone: "warning" };
    default:
      return { label: "검색 상태 미확인", tone: "default" };
  }
}

export function evaluationView(status: string | null | undefined): StatusView {
  switch (status) {
    case "PENDING":
      return { label: "평가 대기", tone: "info" };
    case "RUNNING":
      return { label: "평가 진행 중", tone: "info" };
    case "COMPLETED":
      return { label: "평가 완료", tone: "success" };
    case "FAILED":
      return { label: "평가 실패", tone: "error" };
    default:
      return { label: "평가 미실행", tone: "default" };
  }
}

export function locationLabel(scheme: string | null | undefined): string {
  switch (scheme) {
    case "PAGE":
    case "PAGE_BBOX":
      return "페이지 위치 연결";
    case "EPUB_RESOURCE_ELEMENT":
      return "EPUB 장·요소 위치 연결";
    case "SLIDE":
    case "SLIDE_SHAPE":
      return "슬라이드 위치 연결";
    case "SHEET":
    case "SHEET_CELL_RANGE":
      return "시트·셀 위치 연결";
    case "SECTION":
    case "TEXT_OFFSET":
    case "SOURCE_REF":
      return "문서 구조 위치 연결";
    default:
      return "원문 위치 연결";
  }
}

function unavailableMeasurement(
  state: RagMeasurementState,
  reasonCode: string | null,
): MeasurementView {
  const label = state === "NOT_APPLICABLE"
    ? "적용 대상 아님"
    : state === "FAILED"
      ? "측정 실패"
      : "측정되지 않음";
  return { state, label, measured: false, value: null, reasonCode };
}

export function percentMeasurement(
  measurement: RagMeasuredValueDto<number> | null | undefined,
  digits = 1,
): MeasurementView {
  const state = measurement?.state ?? "NOT_MEASURED";
  const reasonCode = measurement?.reasonCode ?? null;
  if (state !== "MEASURED" || measurement?.value == null) {
    return unavailableMeasurement(state, reasonCode);
  }
  const value = measurement.value;
  return {
    state,
    label: `${(value * 100).toFixed(digits)}%`,
    measured: true,
    value,
    reasonCode,
  };
}

export function countMeasurement(
  measurement: RagMeasuredValueDto<number> | null | undefined,
): MeasurementView {
  const state = measurement?.state ?? "NOT_MEASURED";
  const reasonCode = measurement?.reasonCode ?? null;
  if (state !== "MEASURED" || measurement?.value == null) {
    return unavailableMeasurement(state, reasonCode);
  }
  return {
    state,
    label: measurement.value.toLocaleString(),
    measured: true,
    value: measurement.value,
    reasonCode,
  };
}

export function reasonLabel(reasonCode: string): string {
  return REASON_LABELS[reasonCode] ?? reasonCode;
}

export function canRunAutoEvaluation(
  assessment: DocumentUsabilityAssessmentDto,
  basisMatches: boolean,
  evaluating: boolean,
): boolean {
  return basisMatches
    && !evaluating
    && assessment.decision.usable
    && assessment.searchability.status === "SEARCHABLE"
    && assessment.ragEvaluation.status !== "PENDING"
    && assessment.ragEvaluation.status !== "RUNNING";
}

export function shouldPollUsability(assessment: DocumentUsabilityAssessmentDto | undefined): boolean {
  if (!assessment) return false;
  return assessment.indexing.execution.status === "PENDING"
    || assessment.indexing.execution.status === "RUNNING"
    || assessment.ragEvaluation.status === "PENDING"
    || assessment.ragEvaluation.status === "RUNNING";
}
