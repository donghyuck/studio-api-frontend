import { describe, expect, it } from "vitest";
import { deriveRagOutcome } from "./ragOutcome";
import type { ChatResponseMetadataDto } from "@/types/studio/ai";

function metadata(
  type: "ANSWERED" | "EVIDENCE_ONLY" | "ABSTAINED",
  reasonCode:
    | "NONE"
    | "NO_RETRIEVAL_RESULTS"
    | "NO_PACKED_EVIDENCE"
    | "MISSING_CITATION"
): ChatResponseMetadataDto {
  return {
    canonicalContent: "canonical",
    ragReferences:
      type === "ABSTAINED"
        ? []
        : [
            {
              citationIndex: 1,
              evidenceId: "evidence-1",
              usageStatus: type === "ANSWERED" ? "CITED" : "RETRIEVED_ONLY",
              exactText: "verified excerpt",
            },
          ],
    ragAnswerOutcome: {
      type,
      stage: type === "ANSWERED" ? "NONE" : "VALIDATION",
      reasonCode,
      retrievedResultCount: type === "ABSTAINED" ? 0 : 1,
      acceptedResultCount: type === "ABSTAINED" ? 0 : 1,
      packedEvidenceCount: type === "ABSTAINED" ? 0 : 1,
      usedEvidenceIndexes: type === "ABSTAINED" ? [] : [1],
      citationValidationStatus: type === "ANSWERED" ? "INDEX_VALID" : "MISSING_CITATION",
      policyValidationStatus: type === "ANSWERED" ? "STRUCTURE_VALID" : "CITATION_INVALID",
      validationUnitCount: 1,
      citedValidationUnitCount: type === "ANSWERED" ? 1 : 0,
    },
  };
}

describe("deriveRagOutcome", () => {
  it("activates inline citations only for canonical answered results", () => {
    const view = deriveRagOutcome(metadata("ANSWERED", "NONE"));

    expect(view.citationsReady).toBe(true);
    expect(view.referencesTitle).toBe("답변에 사용된 근거");
  });

  it("shows evidence candidates without activating inline citations", () => {
    const view = deriveRagOutcome(metadata("EVIDENCE_ONLY", "MISSING_CITATION"));

    expect(view.citationsReady).toBe(false);
    expect(view.referencesTitle).toBe("검색된 근거 후보");
    expect(view.notice).toContain("인용 검증에 실패");
  });

  it.each([
    ["NO_RETRIEVAL_RESULTS", "검색 기준을 통과한 문서 구간이 없습니다."],
    ["NO_PACKED_EVIDENCE", "관련 구간은 찾았지만 답변 근거로 구성하지 못했습니다."],
  ] as const)("maps %s to its reader-facing notice", (reasonCode, expected) => {
    const view = deriveRagOutcome(metadata("ABSTAINED", reasonCode));

    expect(view.notice).toBe(expected);
    expect(view.citationsReady).toBe(false);
  });

  it("keeps citations disabled while the request is pending", () => {
    expect(deriveRagOutcome(metadata("ANSWERED", "NONE"), true).citationsReady).toBe(false);
  });

  it("keeps citations active and explains omitted factual-list items", () => {
    const value = metadata("ANSWERED", "NONE");
    if (value.ragAnswerOutcome) {
      value.ragAnswerOutcome.partial = true;
      value.ragAnswerOutcome.originalValidationUnitCount = 3;
      value.ragAnswerOutcome.omittedValidationUnitCount = 1;
    }

    const view = deriveRagOutcome(value);

    expect(view.citationsReady).toBe(true);
    expect(view.referencesTitle).toBe("답변에 사용된 근거");
    expect(view.notice).toContain("1개는 제외");
  });
});
