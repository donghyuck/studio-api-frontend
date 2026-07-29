// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RagAnswerModeSelector } from "./RagAnswerModeSelector";

describe("RagAnswerModeSelector", () => {
  it("explains that answer mode does not change retrieval or indexing", () => {
    render(
      <RagAnswerModeSelector
        capabilities={{
          defaultMode: "GROUNDED_INFERENCE",
          maximumMode: "GROUNDED_INFERENCE",
          clientSelectionEnabled: true,
          policyVersion: "test",
          availableModes: ["STRICT_GROUNDED", "GROUNDED_INFERENCE"],
        }}
        value="GROUNDED_INFERENCE"
        onChange={vi.fn()}
      />
    );

    expect(
      screen.getByText(/답변 모드는 검색 결과나 색인을 변경하지 않습니다/)
    ).toBeTruthy();
  });
});
