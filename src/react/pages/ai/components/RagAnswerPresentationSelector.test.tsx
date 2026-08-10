// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RagAnswerPresentationSelector } from "./RagAnswerPresentationSelector";

const capabilities = {
  enabled: true,
  defaultPreference: "AUTO" as const,
  clientSelectionEnabled: true,
  policyVersion: "rag-answer-presentation-v1:test",
  availablePreferences: ["AUTO", "TEXT_FOCUSED", "VISUAL_PREFERRED"] as const,
  allowedBlockTypes: ["MARKDOWN", "TABLE"],
};

describe("RagAnswerPresentationSelector", () => {
  it("shows the server options and reports the selected preference", () => {
    const onChange = vi.fn();
    render(
      <RagAnswerPresentationSelector
        capabilities={{ ...capabilities, availablePreferences: [...capabilities.availablePreferences] }}
        value="AUTO"
        onChange={onChange}
      />
    );

    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "시각 자료 우선" }));
    expect(onChange).toHaveBeenCalledWith("VISUAL_PREFERRED");
    expect(screen.getByText(/검색 범위와 근거 규칙은 바뀌지 않습니다/)).toBeTruthy();
  });
});
