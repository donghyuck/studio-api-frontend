// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RagEvidenceSourceSummary } from "./RagEvidenceSourceSummary";

describe("RagEvidenceSourceSummary", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders summary with attached document and web sources count", () => {
    const onOpenDrawer = vi.fn();
    render(
      <RagEvidenceSourceSummary
        attachedDocumentName="report.pdf"
        selectedWebSourcesCount={2}
        onOpenDrawer={onOpenDrawer}
      />
    );

    expect(screen.getAllByText("참고자료")[0]).toBeDefined();
    expect(screen.getByText("문서 1개 (report.pdf)")).toBeDefined();
    expect(screen.getByText("수집한 웹 2개")).toBeDefined();

    const button = screen.getByRole("button", { name: "자료 관리" });
    fireEvent.click(button);
    expect(onOpenDrawer).toHaveBeenCalledTimes(1);
  });

  it("renders summary without attached document", () => {
    const onOpenDrawer = vi.fn();
    render(
      <RagEvidenceSourceSummary
        selectedWebSourcesCount={0}
        onOpenDrawer={onOpenDrawer}
      />
    );

    expect(screen.getAllByText("참고자료")[0]).toBeDefined();
    expect(screen.queryByText(/문서 1개/)).toBeNull();
    expect(screen.getByText("수집한 웹 0개")).toBeDefined();
  });
});
