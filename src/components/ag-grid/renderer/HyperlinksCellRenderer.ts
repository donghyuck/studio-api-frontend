import type { ICellRendererParams } from "ag-grid-community";
import type { Router, RouteLocationRaw } from "vue-router";

/**
 * Usage (ag-Grid colDef):
 * {
 *   field: "name",
 *   cellRenderer: HyperlinksCellRenderer,
 *   cellRendererParams: {
 *     mode: "router" | "href" | "callback",
 *     to:   (data, p) => ({ name: "routeName", params: { id: data.id } }),
 *     href: (data, p) => `https://example.com/${data.id}`,
 *     text: (data, p) => data.name, // defaults to p.value
 *     title: (data, p) => "tooltip",
 *     icon: "mdi-open-in-new", // class or SVG string or HTMLElement
 *     // callback mode: use onClick; return false in beforeClick to cancel
 *     beforeClick: (data, p, ev) => true,
 *     onClick: (data, p, ev) => { ... },
 *     afterClick: (data, p) => { ... },
 *   }
 * }
 */

/* =========================
   타입 정의
   ========================= */
type Mode = "router" | "href" | "callback";

type IconInput =
  | string
  | HTMLElement
  | ((data: any, p: ICellRendererParams) => string | HTMLElement | null | undefined);

type ClassInput =
  | string
  | ((data: any, p: ICellRendererParams) => string | null | undefined);

export interface HyperlinksParams {
  /** 네비 모드: 'router' | 'href' | 'callback' | 동적 결정 함수 */
  mode?: Mode | ((p: ICellRendererParams) => Mode);

  /** router 모드: 라우트 빌더 */
  to?: (data: any, p: ICellRendererParams) => RouteLocationRaw | null | undefined;

  /** href 모드: URL 빌더 */
  href?: (data: any, p: ICellRendererParams) => string | null | undefined;

  /** 표시 텍스트(없으면 p.value 사용) */
  text?: (data: any, p: ICellRendererParams) => string | null | undefined;

  /** href 모드: 새 탭 열기 여부 (기본 true) */
  newTab?: boolean;

  /** title 속성(툴팁) */
  title?: (data: any, p: ICellRendererParams) => string | null | undefined;

  /** 셀 선택/편집 방해(이벤트 전파 차단, 기본 true) */
  stopPropagation?: boolean;

  /** (선택) 라우터 직접 주입 (context.router가 없을 때 사용) */
  router?: Router;

  /* ---------- 콜백 모드 ---------- */
  onClick?: (data: any, p: ICellRendererParams, ev: MouseEvent) => void | Promise<void>;
  beforeClick?: (data: any, p: ICellRendererParams, ev: MouseEvent) => boolean | Promise<boolean>;
  afterClick?: (data: any, p: ICellRendererParams) => void | Promise<void>;
  disabled?: (data: any, p: ICellRendererParams) => boolean | null | undefined;
  loadingText?: string;

  /* ---------- 아이콘 ---------- */
  icon?: IconInput;                        // 기본 아이콘
  iconPosition?: "left" | "right";         // 기본 'left'
  iconGap?: number | string;               // 기본 '0.25rem'
  loadingIcon?: IconInput;                 // 로딩 아이콘(없으면 기본 스피너)

  /* ---------- 클래스 지정 ----------
     레거시 호환용 className, iconWrapperClassName도 유지(문자열).
     아래 동적 클래스들은 문자열/함수 모두 지원. */
  className?: string;                      // 레거시 앵커 기본 클래스 (문자열)
  iconWrapperClassName?: string;           // 레거시 아이콘 래퍼 기본 클래스 (문자열)

  anchorClassName?: ClassInput;            // 앵커에 추가할 클래스
  iconClassName?: ClassInput;              // 아이콘(<i>/SVG)에 추가할 클래스
  labelClassName?: ClassInput;             // 라벨(span)에 적용할 클래스(문자열/함수)
  loadingIconWrapperClassName?: ClassInput;// 로딩 아이콘 래퍼에 적용할 클래스
  disabledClassName?: ClassInput;          // 비활성화 상태 클래스 (기본 'is-disabled')
  loadingClassName?: ClassInput;           // 로딩 상태 클래스 (기본 'is-loading')
}

/* =========================
   유틸: 클래스 적용
   ========================= */
function applyClass(
  el: HTMLElement,
  cls: ClassInput | undefined,
  data: any,
  p: ICellRendererParams,
  fallback?: string
) {
  const val = typeof cls === "function" ? cls(data, p) : cls;
  const finalClass = (val ?? fallback ?? "").trim();
  if (finalClass) {
    el.classList.add(...finalClass.split(/\s+/).filter(Boolean));
  }
}

function removeClass(
  el: HTMLElement,
  cls: ClassInput | undefined,
  data: any,
  p: ICellRendererParams,
  fallback?: string
) {
  const val = typeof cls === "function" ? cls(data, p) : cls;
  const finalClass = (val ?? fallback ?? "").trim();
  if (finalClass) {
    el.classList.remove(...finalClass.split(/\s+/).filter(Boolean));
  }
}

/* =========================
   유틸: 아이콘 정규화
   ========================= */
function resolveIconEl(
  icon: IconInput | undefined,
  data: any,
  p: ICellRendererParams
): HTMLElement | null {
  if (!icon) return null;

  let result: string | HTMLElement | null | undefined = icon as any;
  if (typeof icon === "function") result = icon(data, p);
  if (!result) return null;

  if (result instanceof HTMLElement) return result;

  if (typeof result === "string") {
    const s = result.trim();
    // 인라인 SVG 문자열로 추정
    if (s.startsWith("<")) {
      const span = document.createElement("span");
      span.innerHTML = s;
      const first = span.firstElementChild as HTMLElement | null;
      return first ?? span;
    }
    // 아이콘 폰트 클래스
    const i = document.createElement("i");
    const needsMdiPrefix = s.startsWith("mdi-") && !s.includes("mdi ");
    i.className = needsMdiPrefix ? `mdi ${s}` : s;
    i.setAttribute("aria-hidden", "true");
    return i;
  }
  return null;
}

function makeDefaultSpinner(): HTMLElement {
  const spinner = document.createElement("span");
  spinner.className = "ag-link__spinner";
  spinner.setAttribute("aria-hidden", "true");
  return spinner;
}

/* =========================
   본체: HyperlinksCellRenderer
   ========================= */
export function HyperlinksCellRenderer(p: ICellRendererParams) {
  const params = (p.colDef?.cellRendererParams ?? {}) as HyperlinksParams;
  const data = p.data;

  /* 모드 결정 & 라우터 */
  const router: Router | undefined =
    params.router ?? ((p.context as any)?.router as Router | undefined);

  const resolvedMode: Mode =
    typeof params.mode === "function"
      ? params.mode(p)
      : (params.mode ?? (router ? "router" : "href"));

  /* 텍스트 */
  const rawText = params.text?.(data, p) ?? p.value ?? "";
  const txt = String(rawText ?? "");
  const hasText = txt !== "";

  /* 앵커 */
  const a = document.createElement("a");
  a.tabIndex = 0;
  // 레거시 기본 클래스
  if (params.className) {
    a.classList.add(...params.className.split(/\s+/).filter(Boolean));
  }
  // 동적 클래스(기본 ag-link 부여)
  applyClass(a, params.anchorClassName, data, p, "ag-link");

  /* title */
  const tooltip = params.title?.(data, p);
  if (tooltip) a.title = tooltip;

  /* rel */
  a.rel = "noopener noreferrer";

  /* 이벤트 전파 차단 */
  if (params.stopPropagation !== false) {
    const stop = (e: Event) => e.stopPropagation();
    a.addEventListener("click", stop);
    a.addEventListener("mousedown", stop);
  }

  /* 키보드 접근성 (Enter/Space → click) */
  a.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") a.click();
  });

  /* 아이콘/라벨 DOM 구성 */
  const iconEl = resolveIconEl(params.icon, data, p);
  const iconGapValue =
    typeof params.iconGap === "number" ? `${params.iconGap}px` : (params.iconGap ?? "0.25rem");

  const iconWrapper = iconEl ? document.createElement("span") : null;
  if (iconWrapper && iconEl) {
    // 레거시 아이콘 래퍼 기본 클래스
    iconWrapper.className = params.iconWrapperClassName ?? "ag-link__icon";
    // 아이콘 자체 클래스
    applyClass(iconEl, params.iconClassName, data, p);
    iconWrapper.appendChild(iconEl);
  }

  const labelSpan = document.createElement("span");
  // labelClassName(문자열/함수) 모두 지원하되 기본은 ag-link__label
  if (typeof params.labelClassName === "function") {
    applyClass(labelSpan, params.labelClassName, data, p, "ag-link__label");
  } else {
    labelSpan.className = params.labelClassName ?? "ag-link__label";
  }
  if (hasText) labelSpan.textContent = txt;

  // 삽입 순서
  const iconRight = params.iconPosition === "right";
  if (iconWrapper && !iconRight) {
    a.appendChild(iconWrapper);
    (iconWrapper as HTMLElement).style.marginRight = hasText ? iconGapValue : "";
  }
  if (hasText) a.appendChild(labelSpan);
  if (iconWrapper && iconRight) {
    (iconWrapper as HTMLElement).style.marginLeft = hasText ? iconGapValue : "";
    a.appendChild(iconWrapper);
  }

  // 텍스트/아이콘 모두 없으면 렌더 안 함
  if (!hasText && !iconWrapper) return "";

  // a11y: 아이콘만 있을 경우 레이블 보강
  if (!hasText && iconWrapper) {
    const aria =
      tooltip ??
      (() => {
        const to = params.to?.(data, p);
        if (resolvedMode === "router" && to && router) return router.resolve(to).href;
        if (resolvedMode === "href") return params.href?.(data, p) ?? undefined;
        return undefined;
      })() ??
      "action";
    a.setAttribute("aria-label", aria);
  }

  /* ---- 모드별 동작 ---- */
  if (resolvedMode === "router") {
    const to = params.to?.(data, p);
    if (!router || !to) return a;
    const resolved = router.resolve(to);
    a.href = resolved.href;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      router.push(to);
    });
    return a;
  }

  if (resolvedMode === "href") {
    const href = params.href?.(data, p);
    if (!href) return a;
    a.href = href;
    if (params.newTab !== false) {
      a.target = "_blank";
    }
    return a;
  }

  /* ---- "callback" 모드 ---- */
  const disabled = !!params.disabled?.(data, p);
  const disabledFallback = "is-disabled";
  const loadingFallback = "is-loading";

  if (disabled) {
    applyClass(a, params.disabledClassName, data, p, disabledFallback);
    a.setAttribute("aria-disabled", "true");
    a.style.pointerEvents = "none";
    a.style.opacity = "0.6";
    return a;
  }

  a.href = "javascript:void(0)";

  // 로딩 아이콘 준비
  const loadingIconEl = resolveIconEl(params.loadingIcon, data, p) ?? makeDefaultSpinner();

  const setLoading = (on: boolean) => {
    if (on) {
      applyClass(a, params.loadingClassName, data, p, loadingFallback);
      a.setAttribute("aria-busy", "true");

      // 텍스트만 교체(아이콘은 유지)
      const original = labelSpan.textContent ?? "";
      if (!labelSpan.dataset._orig) labelSpan.dataset._orig = original;
      if (params.loadingText) labelSpan.textContent = params.loadingText;

      // 로딩 아이콘은 꼬리에 붙임
      if (!a.querySelector(".ag-link__loading-icon")) {
        const wrapper = document.createElement("span");
        applyClass(wrapper, params.loadingIconWrapperClassName, data, p, "ag-link__loading-icon");
        wrapper.style.marginLeft = (hasText || iconWrapper) ? "0.25rem" : "0";
        wrapper.appendChild(loadingIconEl);
        a.appendChild(wrapper);
      }

      a.style.pointerEvents = "none";
      a.style.opacity = "0.7";
    } else {
      removeClass(a, params.loadingClassName, data, p, loadingFallback);
      a.removeAttribute("aria-busy");

      // 텍스트 복원
      if (labelSpan.dataset._orig) {
        labelSpan.textContent = labelSpan.dataset._orig;
        delete labelSpan.dataset._orig;
      }

      // 로딩 아이콘 제거
      const tail = a.querySelector(".ag-link__loading-icon");
      if (tail) tail.remove();

      a.style.pointerEvents = "";
      a.style.opacity = "";
    }
  };

  a.addEventListener("click", async (e: MouseEvent) => {
    e.preventDefault();

    if (params.beforeClick) {
      const ok = await Promise.resolve(params.beforeClick(data, p, e));
      if (!ok) return;
    }

    try {
      if (params.onClick) {
        const maybe = params.onClick(data, p, e);
        if (maybe && typeof (maybe as any).then === "function") {
          setLoading(true);
          await (maybe as Promise<void>);
        }
      }
      if (params.afterClick) {
        await Promise.resolve(params.afterClick(data, p));
      }
    } finally {
      setLoading(false);
    }
  });

  return a;
}
