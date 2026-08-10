// @vitest-environment jsdom

import { createHash } from "node:crypto";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RagAnswerBlocks } from "./RagAnswerBlocks";

describe("RagAnswerBlocks", () => {
  it("renders only blocks bound to the canonical answer and preserves citation clicks", async () => {
    const onCitationClick = vi.fn();
    const canonicalContent = "검증된 canonical 답변";
    render(
      <RagAnswerBlocks
        document={{
          schemaVersion: "rag-answer-blocks-v1",
          canonicalContentFingerprint: createHash("sha256").update(canonicalContent).digest("hex"),
          blocks: [{
            blockId: "chart-1",
            type: "CHART",
            chartType: "BAR",
            title: "사건 수",
            unit: "",
            points: [
              { label: "2024", value: 12, citationIndexes: [1] },
              { label: "2025", value: 18, citationIndexes: [2] },
            ],
          }],
        }}
        canonicalContent={canonicalContent}
        onCitationClick={onCitationClick}
      />
    );

    expect(await screen.findByTestId("rag-answer-chart")).toBeTruthy();
    expect(screen.getByText("사건 수")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "근거 2" }));
    expect(onCitationClick).toHaveBeenCalledWith([2], expect.anything());
  });

  it("hides stale blocks whose fingerprint does not match canonical content", () => {
    const { container } = render(
      <RagAnswerBlocks
        canonicalContent="new answer"
        document={{
          schemaVersion: "rag-answer-blocks-v1",
          canonicalContentFingerprint: createHash("sha256").update("old answer").digest("hex"),
          blocks: [{
            blockId: "chart-stale",
            type: "CHART",
            chartType: "BAR",
            title: "stale",
            unit: "",
            points: [{ label: "A", value: 1, citationIndexes: [1] }],
          }],
        }}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders only authorized same-origin source-image paths and links their citations", async () => {
    const onCitationClick = vi.fn();
    const canonicalContent = "PDF 근거가 포함된 답변 [3]";
    render(
      <RagAnswerBlocks
        canonicalContent={canonicalContent}
        onCitationClick={onCitationClick}
        document={{
          schemaVersion: "rag-answer-blocks-v1",
          canonicalContentFingerprint: createHash("sha256").update(canonicalContent).digest("hex"),
          blocks: [{
            blockId: "source-image-1",
            type: "SOURCE_IMAGE",
            mediaType: "image/png",
            src: "/api/ai/chat/rag/source-images/abcdefghijklmnopqrstuvwxyz012345",
            alt: "검증된 PDF 근거 페이지",
            page: 7,
            citationIndexes: [3],
          }],
        }}
      />
    );

    const image = await screen.findByRole("img", { name: "검증된 PDF 근거 페이지" });
    expect(image.getAttribute("src")).toBe(
      "/api/ai/chat/rag/source-images/abcdefghijklmnopqrstuvwxyz012345");
    expect(image.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(screen.getByText("원문 PDF 7페이지")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "근거 3" }));
    expect(onCitationClick).toHaveBeenCalledWith([3], expect.anything());
  });

  it("rejects external and non-http source-image values", async () => {
    const canonicalContent = "검증된 답변";
    const fingerprint = createHash("sha256").update(canonicalContent).digest("hex");
    const { container } = render(
      <RagAnswerBlocks
        canonicalContent={canonicalContent}
        document={{
          schemaVersion: "rag-answer-blocks-v1",
          canonicalContentFingerprint: fingerprint,
          blocks: [
            {
              blockId: "external",
              type: "SOURCE_IMAGE",
              mediaType: "image/png",
              src: "https://attacker.example/image.png",
              alt: "external",
              page: 1,
              citationIndexes: [1],
            },
            {
              blockId: "script",
              type: "SOURCE_IMAGE",
              mediaType: "image/png",
              src: "javascript:alert(1)",
              alt: "script",
              page: 1,
              citationIndexes: [1],
            },
          ],
        }}
      />
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.querySelector("img")).toBeNull();
  });

  it("ignores unknown schemas", () => {
    const { container } = render(
      <RagAnswerBlocks document={{ schemaVersion: "unknown", blocks: [] }} />
    );
    expect(container.firstChild).toBeNull();
  });
});
