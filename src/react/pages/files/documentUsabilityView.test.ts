import { describe, expect, it } from "vitest";
import type { DocumentUsabilityAssessmentDto, RagMeasuredValueDto } from "@/types/studio/ai";
import {
  canRunAutoEvaluation,
  decisionView,
  locationLabel,
  percentMeasurement,
  reasonLabel,
} from "./documentUsabilityView";

function measured(value: number): RagMeasuredValueDto<number> {
  return { state: "MEASURED", value, reasonCode: null };
}

describe("documentUsabilityView", () => {
  it("keeps a measured zero distinct from a missing measurement", () => {
    expect(percentMeasurement(measured(0))).toMatchObject({
      measured: true,
      label: "0.0%",
      value: 0,
    });
    expect(percentMeasurement({ state: "NOT_MEASURED", value: null, reasonCode: "NOT_RUN" })).toMatchObject({
      measured: false,
      label: "측정되지 않음",
      value: null,
    });
  });

  it("renders not-applicable page coverage without turning it into zero", () => {
    expect(percentMeasurement({
      state: "NOT_APPLICABLE",
      value: null,
      reasonCode: "PAGE_COVERAGE_NOT_APPLICABLE",
    })).toMatchObject({
      measured: false,
      label: "적용 대상 아님",
      value: null,
    });
  });

  it("maps known and future server states safely", () => {
    expect(decisionView("AVAILABLE_WITH_REVIEW")).toEqual({
      label: "사용 가능 · 검토 필요",
      tone: "warning",
    });
    expect(decisionView("FUTURE_STATE")).toEqual({ label: "상태 확인 필요", tone: "default" });
    expect(locationLabel("EPUB_RESOURCE_ELEMENT")).toBe("EPUB 장·요소 위치 연결");
    expect(locationLabel("SHEET_CELL_RANGE")).toBe("시트·셀 위치 연결");
    expect(reasonLabel("FUTURE_REASON")).toBe("FUTURE_REASON");
  });

  it("allows automatic evaluation only for the matching searchable basis", () => {
    const assessment = {
      decision: { usable: true },
      searchability: { status: "SEARCHABLE" },
      ragEvaluation: { status: "NOT_RUN" },
    } as DocumentUsabilityAssessmentDto;

    expect(canRunAutoEvaluation(assessment, true, false)).toBe(true);
    expect(canRunAutoEvaluation(assessment, false, false)).toBe(false);
    expect(canRunAutoEvaluation({
      ...assessment,
      searchability: { ...assessment.searchability, status: "NOT_SEARCHABLE" },
    }, true, false)).toBe(false);
  });
});
