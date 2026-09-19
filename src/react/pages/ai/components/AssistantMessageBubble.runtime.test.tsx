// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AssistantMessageBubble } from "./AssistantMessageBubble";

afterEach(cleanup);

describe("runtime answer provenance", () => {
  it("shows system provenance without a misleading model or document badge", () => {
    render(<AssistantMessageBubble
      message={{ role: "assistant", content: "오늘은 2026년 9월 18일입니다.", model: "gemini-example",
        metadata: { answerSource: "SYSTEM_CONTEXT", effectiveTimezone: "Asia/Seoul", asOf: "2026-09-18T00:00:00Z" } }}
      sending={false} isLastAssistant={true} metadataDensity="compact"
      onCopy={vi.fn()} onRegenerate={vi.fn()} onRetryLastUser={vi.fn()} />);
    expect(screen.getByText("시스템 기준")).toBeTruthy();
    expect(screen.queryByText("문서 근거")).toBeNull();
    expect(screen.queryByText("gemini-example")).toBeNull();
  });
});
