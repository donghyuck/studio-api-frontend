// src/plugins/axios.ts
import axios from 'axios';
import { API_BASE_URL } from "@/config/backend";
import { useAuthStore } from '@/stores/studio/mgmt/auth.store';
import { parseJwtExp } from "@/utils/jwt";

const api = axios.create({
  baseURL: API_BASE_URL,
});

let isRefreshing = false;
type RefreshQueueItem = {
  resolve: () => void;
  reject: (err: unknown) => void;
};
let failedQueue: RefreshQueueItem[] = [];

function processQueue(error?: unknown) {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve();
  });
  failedQueue = [];
}

function isTokenExpired(token: string, skewSeconds = 30): boolean {
  const exp = parseJwtExp(token);
  if (!exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return exp < now + skewSeconds;
}

// ✅ 요청 인터셉터
api.interceptors.request.use(async config => {
  const auth = useAuthStore(); 
  if (auth.token) {
    // 🔍 토큰 만료 확인
    if (isTokenExpired(auth.token)) {
      if (import.meta.env.DEV) {
        console.debug(
          isRefreshing ? "토큰 갱신 중..." : "토큰 만료, 갱신 시도 중..."
        );
      }
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          await auth.refreshTokens();
          processQueue();
        } catch (error) {
          processQueue(error);
          auth.logout();
        } finally {
          isRefreshing = false;
        }
      }
      // 이미 갱신 중이면 큐에 넣고 기다리기
      await new Promise<void>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      });
    }
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${auth.token}`;
  }
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    return Promise.reject(error);
  }
);

export default api; 
