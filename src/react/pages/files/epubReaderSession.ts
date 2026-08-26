export type EpubNavItem = {
  id?: string;
  href: string;
  label: string;
  subitems?: EpubNavItem[];
};

export type EpubLocation = {
  start: {
    index?: number;
    percentage?: number;
    href: string;
  };
};

export type EpubRendition = {
  themes: {
    fontSize: (value: string) => void;
    default: (styles: Record<string, Record<string, string>>) => void;
  };
  attachTo: (element: HTMLElement) => void;
  display: (target?: string) => Promise<unknown>;
  on: (event: string, listener: (location: EpubLocation) => void) => void;
  prev: () => void;
  next: () => void;
  destroy: () => void;
};

export type EpubBook = {
  manifest: unknown;
  toc?: EpubNavItem[];
  sections?: { length?: number };
};

type EpubEngine = {
  open: (data: ArrayBuffer) => Promise<EpubBook | undefined>;
  destroy: () => void;
};

export type EpubFactory = {
  (): EpubEngine | Promise<EpubEngine>;
  Rendition: new (manifest: unknown, options: Record<string, unknown>) => EpubRendition;
  ViewManagers: { default: unknown };
  Views: { iframe: unknown };
};

export type EpubReaderSession = {
  engine: EpubEngine;
  book: EpubBook;
  rendition: EpubRendition;
  sectionCount: number;
};

function safelyDestroy(resource: { destroy: () => void } | null | undefined) {
  try {
    resource?.destroy();
  } catch {
    // Reader cleanup must never break React's dialog unmount sequence.
  }
}

export async function createEpubReaderSession(
  factory: EpubFactory,
  data: ArrayBuffer,
  viewerElement: HTMLElement,
): Promise<EpubReaderSession> {
  // epubjs 0.4.x still resolves `ePub` as a browser global inside its ESM rendition code.
  Object.assign(globalThis, { ePub: factory });
  const engine = await factory();
  let rendition: EpubRendition | null = null;

  try {
    const book = await engine.open(data);
    if (!book?.manifest) {
      throw new Error("EPUB 파일 구조를 열 수 없습니다.");
    }

    rendition = new factory.Rendition(book.manifest, {
      width: "100%",
      height: "100%",
      spread: "none",
      manager: factory.ViewManagers.default,
      view: factory.Views.iframe,
    });
    rendition.attachTo(viewerElement);

    return {
      engine,
      book,
      rendition,
      sectionCount: book.sections?.length ?? 0,
    };
  } catch (error) {
    safelyDestroy(rendition);
    safelyDestroy(engine);
    throw error;
  }
}

export function disposeEpubReaderSession(session: EpubReaderSession | null | undefined) {
  if (!session) return;
  safelyDestroy(session.rendition);
  safelyDestroy(session.engine);
}

export function epubProgress(location: EpubLocation, sectionCount: number): number {
  const percentage = location.start.percentage;
  if (typeof percentage === "number" && Number.isFinite(percentage)) {
    return Math.round(Math.max(0, Math.min(1, percentage)) * 100);
  }

  const index = location.start.index;
  if (typeof index === "number" && sectionCount > 1) {
    return Math.round(Math.max(0, Math.min(1, index / (sectionCount - 1))) * 100);
  }
  return 0;
}
