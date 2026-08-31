// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import {
  createEpubReaderSession,
  disposeEpubReaderSession,
  epubProgress,
  type EpubFactory,
  type EpubRendition,
} from "./epubReaderSession";

function renditionMock() {
  return {
    themes: { fontSize: vi.fn(), default: vi.fn() },
    attachTo: vi.fn(),
    display: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    prev: vi.fn(),
    next: vi.fn(),
    destroy: vi.fn(),
  } satisfies EpubRendition;
}

describe("epubReaderSession", () => {
  it("awaits the epub engine and opens a rendition from the resolved book", async () => {
    const rendition = renditionMock();
    const engine = {
      open: vi.fn().mockResolvedValue({ manifest: { title: "book" }, sections: { length: 4 }, toc: [] }),
      destroy: vi.fn(),
    };
    const Rendition = vi.fn(function Rendition() { return rendition; });
    const defaultManager = vi.fn();
    const iframeView = vi.fn();
    const factory = Object.assign(vi.fn().mockResolvedValue(engine), {
      Rendition,
      ViewManagers: { default: defaultManager },
      Views: { iframe: iframeView },
    }) as unknown as EpubFactory;
    const viewer = document.createElement("div");

    const session = await createEpubReaderSession(factory, new ArrayBuffer(8), viewer);

    expect((globalThis as { ePub?: unknown }).ePub).toBe(factory);
    expect(engine.open).toHaveBeenCalledOnce();
    expect(Rendition).toHaveBeenCalledWith({ title: "book" }, expect.objectContaining({
      spread: "none",
      manager: defaultManager,
      view: iframeView,
    }));
    expect(rendition.attachTo).toHaveBeenCalledWith(viewer);
    expect(session.sectionCount).toBe(4);
  });

  it("contains cleanup errors so closing the reader cannot crash the application", () => {
    const rendition = renditionMock();
    rendition.destroy = vi.fn(() => { throw new Error("rendition cleanup failed"); });
    const engine = { open: vi.fn(), destroy: vi.fn(() => { throw new Error("engine cleanup failed"); }) };

    expect(() => disposeEpubReaderSession({
      rendition,
      engine,
      book: { manifest: {} },
      sectionCount: 1,
    })).not.toThrow();
    expect(rendition.destroy).toHaveBeenCalledOnce();
    expect(engine.destroy).toHaveBeenCalledOnce();
  });

  it("uses section position when the library has no generated percentage", () => {
    expect(epubProgress({ start: { href: "chapter-3", index: 2 } }, 5)).toBe(50);
    expect(epubProgress({ start: { href: "chapter-1", percentage: 0 } }, 5)).toBe(0);
  });
});
