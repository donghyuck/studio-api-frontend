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

    expect(container.querySelector("a")).toBeNull();
    expect(within(container).getByText("위험 링크")).toBeTruthy();
  });

  it("renders a GFM table, copies it as tab-separated text, and keeps citations interactive", async () => {
    const onCitationClick = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(
      <RagMarkdownRenderer
        content={"| 학자 | 관련 내용 |\n| --- | --- |\n| 니컬러스 P. 머니 | 진균학자 [1] |\n| 로베르트 레마크 | 백선증 연구 [2] |"}
        references={[
          { index: 1, title: "진균의 역사" },
          { index: 2, title: "진균의 역사" },
        ]}
        onCitationClick={onCitationClick}
      />
    );

    const table = screen.getByRole("table");
    expect(table).toBeTruthy();
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    fireEvent.click(within(table).getByRole("button", { name: "근거 2" }));
    expect(onCitationClick).toHaveBeenCalledWith([2], expect.anything());

    fireEvent.click(screen.getByRole("button", { name: "표 복사" }));
    expect(writeText).toHaveBeenCalledWith(
      "학자\t관련 내용\n니컬러스 P. 머니\t진균학자 [1]\n로베르트 레마크\t백선증 연구 [2]"
    );
    expect(await screen.findByRole("button", { name: "표 복사 완료" })).toBeTruthy();
  });

  it("does not activate model-authored external links or images", () => {
    const { container } = render(
      <RagMarkdownRenderer
        content={"[외부 링크](https://example.com)\n\n![차트](https://example.com/chart.png)"}
        references={[]}
      />
    );

    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(within(container).getByText("외부 링크")).toBeTruthy();
    expect(within(container).getByText("[이미지: 차트]")).toBeTruthy();
  });

  it("does not promote a model-authored citation target with a non-citation label", () => {
    const { container } = render(
      <RagMarkdownRenderer
        content={"[중요 근거](#rag-citation-1)"}
        references={[{ index: 1, title: "문서" }]}
      />
    );

    expect(within(container).queryByRole("button", { name: "근거 1" })).toBeNull();
    expect(within(container).getByText("중요 근거")).toBeTruthy();
  });

  it("falls back to plain text when the rich markdown budget is exceeded", () => {
    render(<RagMarkdownRenderer content={"a".repeat(32_001)} references={[]} />);
    expect(screen.getByTestId("rag-markdown-plain-fallback")).toBeTruthy();
  });
});
