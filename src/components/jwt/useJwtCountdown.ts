// src/utils/useJwtCountdown.ts
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { parseJwtExp  } from "./jwt-utils"

function nowEpoch(): number {
  return Math.floor(Date.now() / 1000);
}

function formatHHMMSS(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return [hh, mm, ss].map(v => String(v).padStart(2, "0")).join(":");
}

/**
 * @param accessTokenRef  ref<string|null|undefined>  JWT 액세스 토큰
 * @param opts.getExp     (jwt) => exp(epoch seconds) | null  (미지정 시 기본 파서 사용)
 * @param opts.tickMs     타이머 간격(ms) (기본 1000)
 * @param opts.clockSkewSec 시계 보정(초) (기본 0~3 권장)
 * @param opts.graceSeconds  만료 후 리프레시 허용 시간(초) (예: 300=5분). 미지정 시 그레이스 기능 비활성.
 *
 * 반환:
 *  - exp: number|null                         // 토큰 만료시각(epoch)
 *  - secondsToExpiry: number                  // 만료까지 남은 초(0 바닥)
 *  - isExpired: boolean                       // 만료 여부
 *  - hhmmssToExpiry: string                   // "HH:MM:SS"
 *  - inGrace: boolean                         // 만료 이후 ~ (exp+graceSeconds) 사이
 *  - secondsGraceLeft: number                 // 그레이스 남은 초(0 바닥)
 *  - hhmmssGraceLeft: string                  // "HH:MM:SS"
 *  - showRefresh: boolean                     // 만료 이후 AND inGrace (리프레시 버튼 노출)
 *  - showLogin: boolean                       // 그레이스까지 지나면 로그인 버튼 노출
 *  - statusText: string                       // UI 표시용 상태문구(선택)
 *  - start()/stop(): 타이머 제어
 */
export function useJwtCountdown(
  accessTokenRef: { value: string | null | undefined },
  opts?: {
    getExp?: (jwt: string | null | undefined) => number | null;
    tickMs?: number;
    clockSkewSec?: number;
    graceSeconds?: number; // ex) 300 = 5분
    preExpiryWindowSec?: number;    // ✅ 추가: 만료 임박 윈도우 (기본 600 = 10분)
  }
) {
  const getExp = opts?.getExp ?? parseJwtExp ;
  const tickMs = opts?.tickMs ?? 1000;
  const clockSkewSec = opts?.clockSkewSec ?? 0;
  const graceSeconds = opts?.graceSeconds ?? 0; // 0이면 그레이스 비활성
 const preExpiryWindowSec = opts?.preExpiryWindowSec ?? 600; // ✅ 기본 10분

  const now = ref(nowEpoch());
  let timer: number | null = null;

  const start = () => {
    stop();
    timer = globalThis.setInterval(() => (now.value = nowEpoch()), tickMs);
  };
  const stop = () => {
    if (timer != null) {
      globalThis.clearInterval(timer);
      timer = null;
    }
  };

  onMounted(start);
  onUnmounted(stop);

  // 토큰이 바뀌면 즉시 한 틱 당겨 계산
  watch(() => accessTokenRef.value, () => (now.value = nowEpoch()));

  // 만료시각
  const exp = computed<number | null>(() => getExp(accessTokenRef.value));

  // 만료까지 남은 초(음수면 이미 만료)
  const _leftToExpiry = computed(() => {
    if (!exp.value) return -Infinity;
    return exp.value - (now.value + clockSkewSec);
  });
  const secondsToExpiry = computed(() => Math.max(0, Math.floor(_leftToExpiry.value)));
  const isExpired = computed(() => _leftToExpiry.value <= 0);
  const hhmmssToExpiry = computed(() => formatHHMMSS(secondsToExpiry.value));
  
  const isExpirySoon = computed(() => !isExpired.value && secondsToExpiry.value <= preExpiryWindowSec);

  // ====== 그레이스 (옵션) ======
  const deadline = computed<number | null>(() => {
    if (!exp.value || !graceSeconds) return null;
    return exp.value + graceSeconds;
  });

  const _leftGrace = computed(() => {
    if (!deadline.value) return -Infinity;
    return deadline.value - (now.value + clockSkewSec);
  });

  const secondsGraceLeft = computed(() => Math.max(0, Math.floor(_leftGrace.value)));
  const inGrace = computed(() => {
    if (!exp.value || !deadline.value) return false;
    const n = now.value + clockSkewSec;
    return n >= exp.value && n < deadline.value;
  });
  const hhmmssGraceLeft = computed(() => formatHHMMSS(secondsGraceLeft.value));

  // UI 편의 플래그
  const showRefresh = computed(() => isExpired.value && inGrace.value);
  const showLogin = computed(() => {
    // 그레이스 미사용: 만료되면 로그인 노출
    if (!graceSeconds) return isExpired.value;
    // 그레이스 사용: 만료 + 그레이스 종료 이후에만 로그인 노출
    return isExpired.value && !inGrace.value && secondsGraceLeft.value === 0;
  });

  const statusText = computed(() => {
    if (!exp.value) return "토큰 없음";
    if (!isExpired.value) return `만료까지 ${hhmmssToExpiry.value}`;
    if (inGrace.value) return `만료됨 · 리프레시 가능 ${hhmmssGraceLeft.value}`;
    return "리프레시 기간 종료";
  });

  return {
    exp,
    secondsToExpiry,
    isExpired,
    hhmmssToExpiry,
    // grace
    inGrace,
    secondsGraceLeft,
    hhmmssGraceLeft,
    isExpirySoon,
    preExpiryWindowSec,
    // ui flags
    showRefresh,
    showLogin,
    statusText,
    // timer control
    start,
    stop,
  };
}
