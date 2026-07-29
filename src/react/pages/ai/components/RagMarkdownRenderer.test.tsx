// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { encodeRagCitations, RagMarkdownRenderer } from "./RagMarkdownRenderer";

describe("RagMarkdownRenderer", () => {
  it("renders structured answers and keeps validated citations interactive", () => {
    const onCitationClick = vi.fn();
    render(
      <RagMarkdownRenderer
        content={"## 관련 과학자\n\n- **니컬러스 P. 머니** — 진균학자입니다. [1]\n- **로베르트 레마크** — 백선증 연구자입니다. [2]"}
        references={[
          { index: 1, title: "진균의 역사", content: "니컬러스 P. 머니는 진균학자이다." },
          { index: 2, title: "진균의 역사", content: "로베르트 레마크는 백선증을 연구했다." },
        ]}
        onCitationClick={onCitationClick}
      />
    );

    expect(screen.getByRole("heading", { name: "관련 과학자" })).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("니컬러스 P. 머니").tagName).toBe("STRONG");

    fireEvent.click(screen.getByRole("button", { name: "근거 1" }));
    expect(onCitationClick).toHaveBeenCalledWith([1], expect.anything());
  });

  it("does not interpret raw html or citation-shaped text inside code", () => {
    const content = "<script>alert('unsafe')</script>\n\n`[1]`과 다음 코드를 설명합니다.\n\n```\n[2]\n```";
    const { container } = render(
      <RagMarkdownRenderer content={content} references={[]} />
    );

    expect(container.querySelector("script")).toBeNull();
    expect(within(container).queryByRole("button", { name: "근거 1" })).toBeNull();
    expect(within(container).queryByRole("button", { name: "근거 2" })).toBeNull();
    expect(within(container).getByText("[1]")).toBeTruthy();
    expect(within(container).getByText("[2]")).toBeTruthy();
  });

  it("encodes citations outside code blocks only", () => {
    expect(encodeRagCitations("설명 [1, 2]\n\n```\n[3]\n```"))
      .toBe("설명 [1, 2](#rag-citation-1,2)\n\n```\n[3]\n```");
  });

  it("does not activate citation labels that are absent from validated references", () => {
    const { container } = render(
      <RagMarkdownRenderer
        content={"검증된 근거 [1], 범위 밖 표기 [999]"}
        references={[{ index: 1, title: "문서" }]}
      />
    );

    expect(within(container).getByRole("button", { name: "근거 1" })).toBeTruthy();
    expect(within(container).queryByRole("button", { name: "근거 999" })).toBeNull();
    expect(within(container).getByText(/범위 밖 표기 \[999\]/)).toBeTruthy();
  });

  it("blocks executable links supplied by model output", () => {
    const { container } = render(
      <RagMarkdownRenderer
        content={"[위험 링크](javascript:alert('unsafe'))"}
        references={[]}
      />
    );

    expect(container.querySelector("a")?.getAttribute("href")).toBeNull();
  });
});
