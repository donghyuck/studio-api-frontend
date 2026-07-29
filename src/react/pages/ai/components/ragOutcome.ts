import type {
  ChatResponseMetadataDto,
  RagAnswerOutcomeDto,
  RagReferenceDto,
} from "@/types/studio/ai";

export interface RagOutcomeViewModel {
  outcome?: RagAnswerOutcomeDto;
  references: RagReferenceDto[];
  citationsReady: boolean;
  referencesTitle: string;
  notice?: string;
}

export function deriveRagOutcome(
  metadata?: ChatResponseMetadataDto,
  sending = false
): RagOutcomeViewModel {
  const references = Array.isArray(metadata?.ragReferences) ? metadata.ragReferences : [];
  const outcome = metadata?.ragAnswerOutcome;
  const answered = outcome?.type === "ANSWERED";
  const evidenceOnly = outcome?.type === "EVIDENCE_ONLY";

  let notice: string | undefined;
  if (outcome?.reasonCode === "NO_RETRIEVAL_RESULTS") {
    notice = "검색 기준을 통과한 문서 구간이 없습니다.";
  } else if (outcome?.reasonCode === "NO_PACKED_EVIDENCE") {
    notice = "관련 구간은 찾았지만 답변 근거로 구성하지 못했습니다.";
  } else if (evidenceOnly) {
    notice = "관련 근거는 찾았지만 생성 답변의 인용 검증에 실패했습니다.";
  } else if (answered && outcome?.partial) {
    const omitted = Math.max(0, outcome.omittedValidationUnitCount ?? 0);
    notice = omitted > 0
      ? `문서 근거가 확인된 항목을 표시했습니다. 인용이 불완전한 항목 ${omitted}개는 제외했습니다.`
      : "문서 근거가 확인된 항목만 표시했습니다.";
  }

  return {
    outcome,
    references,
    citationsReady:
      !sending &&
      answered &&
      references.some((reference) => reference.usageStatus === "CITED") &&
      typeof metadata?.canonicalContent === "string",
    referencesTitle: evidenceOnly ? "검색된 근거 후보" : "답변에 사용된 근거",
    notice,
  };
}
