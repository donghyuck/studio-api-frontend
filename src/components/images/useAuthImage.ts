// src/composables/useAuthImage.ts
import { ref, onBeforeUnmount, watchEffect } from "vue";
import { useAuthStore } from "@/stores/studio/mgmt/auth.store";
import { storeToRefs } from "pinia";

const auth = useAuthStore();
const { token } = storeToRefs(auth);

export interface UseAuthImageOptions {
  /** url이 바뀔 때 이전 ObjectURL을 즉시 revoke */
  revokePrevious?: boolean;
  /** 요청 실패 시 재시도 횟수 */
  retries?: number;
  /** fetch에 넘길 기타 옵션 */
  fetchInit?: RequestInit;
  /** 토큰이 없을 때 대체 이미지 */
  fallbackSrc?: string;
}

export function useAuthImage(
  urlRef: () => string | undefined | null,
  tokenRef: () => string | undefined | null,
  opts: UseAuthImageOptions = {}
) {
  const src = ref<string | undefined>(undefined);
  const loading = ref(false);
  const error = ref<unknown | null>(null);

  let currentObjectUrl: string | null = null;

  const revoke = () => {
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }
  };

  const load = async () => {
    const url = urlRef() || "";
    const jwt = tokenRef() || token.value;
    error.value = null;
    src.value = undefined;
    if (!url) {
      revoke();
      src.value = opts.fallbackSrc;
      return;
    }

    loading.value = true;
    const maxRetries = opts.retries ?? 0;
    let attempt = 0;
    while (true) {
      try {
        const res = await fetch(url, {
          ...opts.fetchInit,
          headers: {
            ...(opts.fetchInit?.headers || {}),
            ...(token ? { Authorization: `Bearer ${jwt}` } : {}),
          },
          // 쿠키 인증도 함께 쓰려면:
          // credentials: 'include',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        if (opts.revokePrevious !== false) revoke();
        currentObjectUrl = objUrl;
        src.value = objUrl;
        break;
      } catch (e) {
        if (attempt++ < maxRetries) continue;
        error.value = e;
        revoke();
        src.value = opts.fallbackSrc;
        break;
      } finally {
        loading.value = false;
      }
    }
  };

  // url 또는 token이 변하면 자동 재로딩
  watchEffect(() => {
    void load();
  });

  onBeforeUnmount(() => revoke());

  return { src, loading, error, reload: load, revoke };
}
