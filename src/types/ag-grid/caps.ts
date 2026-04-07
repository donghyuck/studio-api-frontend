
// --- action/caps.ts ---------------------------------------------

// 액션 종류(필요 시 더 추가)
export type ActionType = "view" | "edit" | "delete" | "download";

// 비트 플래그: 1,2,4,8... (조합 가능)
export enum Cap {
  VIEW      = 1 << 0,  // 1
  EDIT      = 1 << 1,  // 2
  DELETE    = 1 << 2,  // 4
  DOWNLOAD  = 1 << 3,  // 8
}

// 액션이 요구하는 최소 권한 매핑
export const RequiredCaps: Record<ActionType, Cap> = {
  view: Cap.VIEW,
  edit: Cap.EDIT,
  delete: Cap.DELETE,
  download: Cap.DOWNLOAD,
};

// 유틸: caps가 need를 모두 포함하는가?
export const hasCaps = (caps: number, need: number) => (caps & need) === need;

// 컨텍스트(권한·리소스 상태 등) → 보유 캡스 계산 규칙
export interface UserCtx {
  roles: string[];             // 예: ["ADMIN","EDITOR"]
  id?: string;
}

export interface ResourceCtx {
  ownerId?: string;
  locked?: boolean;
  deleted?: boolean;
}

export interface Context {
  user: UserCtx;
  resource?: ResourceCtx;
}

// 규칙: 상황에 따라 보유 캡스 계산(서버/클라 동일 규칙 권장)
export function calcCaps(ctx: Context): number {
  let caps = Cap.VIEW; // 기본 조회 허용

  if (ctx.user.roles.includes("EDITOR")) {
    caps |= Cap.EDIT;
  }
  if (ctx.user.roles.includes("ADMIN")) {
    caps |= Cap.DELETE | Cap.DOWNLOAD | Cap.EDIT;
  }
  // 리소스 상태 제약 적용
  if (ctx.resource?.locked)   caps &= ~Cap.EDIT;
  if (ctx.resource?.deleted)  caps &= ~(Cap.EDIT | Cap.DELETE | Cap.DOWNLOAD);

  return caps;
}

// --- 액션 모델 ----------------------------------------------------

export interface ActionItem {
  name: string;
  icon: string;
  event: ActionType;
  text?: string;
  color?: string;
  visible?: boolean;     // default: true
  disabled?: boolean;    // 정책 결과
  reason?: string;       // 비활성 사유(툴팁 등)
}

// 액션 정의(라벨/아이콘/색상 등은 컨텍스트 기반 동적도 가능)
export interface ActionDef {
  type: ActionType;
  label: (ctx: Context) => string;
  icon:  (ctx: Context) => string;
  color?: (ctx: Context) => string;
  // 필요 시 here에 per-action 추가 정책(사유 계산)도 가능
}

// 공용 레지스트리(원하는 액션만 배치)
export const ACTIONS: ActionDef[] = [
  { type: "view",     label: () => "보기",   icon: () => "ph:eye"           },
  { type: "edit",     label: () => "수정",   icon: () => "ph:pencil", color: ()=>"primary" },
  { type: "delete",   label: () => "삭제",   icon: () => "ph:trash",  color: ()=>"danger"  },
  { type: "download", label: () => "다운",   icon: () => "ph:download"      },
];

// 정책 적용: 컨텍스트로부터 caps를 계산 → 액션의 disabled/사유 세팅
export function buildActions(ctx: Context): ActionItem[] {
  const caps = calcCaps(ctx);
  return ACTIONS.map(def => {
    const need = RequiredCaps[def.type];
    const allowed = hasCaps(caps, need);
    const reason =
      allowed ? undefined :
      ctx.resource?.deleted ? "삭제된 항목입니다" :
      ctx.resource?.locked  ? "잠금 상태로 수정 불가" : "권한이 없습니다";
    return {
      name: def.label(ctx),
      icon: def.icon(ctx),
      event: def.type,
      color: def.color?.(ctx),
      visible: true,
      disabled: !allowed,
      reason,
    };
  });
}
