// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RagSourceScopeSelector } from "./RagSourceScopeSelector";

describe("RagSourceScopeSelector", () => {
  it("keeps source scope separate from answer interpretation mode", () => {
    render(
      <RagSourceScopeSelector
        capabilities={{
          defaultScope: "DOCUMENT_ONLY",
          maximumScope: "DOCUMENT_AND_OFFICIAL_EXTERNAL",
          clientSelectionEnabled: true,
          externalProviderAvailable: true,
          policyVersion: "test",
          availableScopes: ["DOCUMENT_ONLY", "DOCUMENT_AND_OFFICIAL_EXTERNAL"],
        }}
        value="DOCUMENT_ONLY"
        onChange={vi.fn()}
      />
    );

    expect(
      screen.getByText(/참고 자료 범위는 검색 대상을 결정하며 답변의 해석 허용 범위와는 별개입니다/)
    ).toBeTruthy();
  });

  it("explains why official external sources are unavailable", () => {
    render(
      <RagSourceScopeSelector
        capabilities={{
          defaultScope: "DOCUMENT_ONLY",
          maximumScope: "DOCUMENT_ONLY",
          clientSelectionEnabled: true,
          externalProviderAvailable: false,
          policyVersion: "test",
          availableScopes: ["DOCUMENT_ONLY"],
        }}
        value="DOCUMENT_ONLY"
        onChange={vi.fn()}
      />
    );

    expect(
      screen.getByText(/서버에 공식 외부 자료 공급자가 설정되지 않아 첨부 문서만 사용할 수 있습니다/)
    ).toBeTruthy();
  });
});
