import { describe, expect, it } from "vitest";
import {
  deriveEvidenceSourceViewModel,
  mapWebKnowledgeError,
  toIndexedWebSourcePayload,
} from "./evidenceSource";

describe("evidenceSource utils", () => {
  it("serializes SITE selection as sourceId + corpusRevisionId", () => {
    const result = toIndexedWebSourcePayload([
      {
        sourceId: "wsrc-site1",
        corpusRevisionId: "wcorpus-site1",
      },
    ]);

    expect(result).toEqual([
      {
        sourceId: "wsrc-site1",
        corpusRevisionId: "wcorpus-site1",
      },
    ]);
  });

  it("serializes SINGLE_PAGE selection as sourceId + revisionId", () => {
    const result = toIndexedWebSourcePayload([
      {
        sourceId: "wsrc-single1",
        revisionId: "wrev-single1",
      },
    ]);

    expect(result).toEqual([
      {
        sourceId: "wsrc-single1",
        revisionId: "wrev-single1",
      },
    ]);
  });

  it("rejects a selected source without a pinned revision", () => {
    expect(() =>
      toIndexedWebSourcePayload([{ sourceId: "wsrc-invalid" }])
    ).toThrow("선택한 웹 자료에 고정된 revision 정보가 없습니다.");
  });

  it("derives correct selection label when sourcePolicy=DOCUMENT_ONLY but indexedWebSourceCount=1", () => {
    const vm = deriveEvidenceSourceViewModel({
      sourcePolicy: {
        effectiveScope: "DOCUMENT_ONLY",
        source: "SERVER_DEFAULT",
        clamped: false,
        reasonCode: "NONE",
        policyVersion: "1.0",
      },
      attachedDocumentName: "manual.pdf",
      selectedWebSourcesCount: 1,
    });

    expect(vm.selectionLabel).toBe("첨부 문서 (manual.pdf) + 수집한 웹 1개");
    expect(vm.documentScopeSelected).toBe(true);
    expect(vm.indexedWebSourceCount).toBe(1);
  });

  it("differentiates packedOrigins and usedOrigins in evidence source view model", () => {
    const vm = deriveEvidenceSourceViewModel({
      selection: {
        documentScopeSelected: true,
        indexedWebSourceCount: 1,
        officialExternalEnabled: false,
        packedOrigins: ["DOCUMENT", "INDEXED_WEB"],
        usedOrigins: ["INDEXED_WEB"],
      },
    });

    expect(vm.selectionLabel).toBe("첨부 문서 + 수집한 웹 1개");
    expect(vm.packedOriginsLabel).toBe("포함된 근거: 문서, 수집한 웹");
    expect(vm.usedOriginsLabel).toBe("답변 근거: 수집한 웹");
  });

  it("maps typed web knowledge error codes to user-friendly Korean messages", () => {
    expect(mapWebKnowledgeError("WEB_SOURCE_REVISION_NOT_READY")).toBe(
      "자료 수집 또는 색인이 아직 완료되지 않았습니다."
    );
    expect(mapWebKnowledgeError("WEB_CORPUS_REVISION_REQUIRED")).toBe(
      "유효한 웹 수집 버전(Revision)이 필요합니다."
    );
    expect(mapWebKnowledgeError("WEB_SOURCE_EMBEDDING_SPACE_MISMATCH")).toBe(
      "선택한 임베딩 모델과 호환되지 않는 웹 자료입니다. (임베딩 규격 불일치)"
    );
    expect(mapWebKnowledgeError("WEB_SOURCE_NOT_FOUND")).toBe(
      "요청한 웹 수집 자료를 찾을 수 없습니다."
    );
    expect(mapWebKnowledgeError("INSUFFICIENT_SOURCE_COVERAGE")).toBe(
      "선택한 자료만으로는 답변에 필요한 근거가 부족합니다."
    );
  });
});
