// src/plugins/axios.ts
import axios from 'axios';
import { useAuthStore } from '@/stores/studio/auth.store';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

let isRefreshing = false;
let failedQueue: any[] = [];

function processQueue(error: any, token: string | null = null) {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
}

function parseJwt(token: string) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string, skewSeconds = 30): boolean {
  const payload = parseJwt(token); 
  if (!payload?.exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now + skewSeconds;
}

// ✅ 요청 인터셉터
api.interceptors.request.use(async config => {
  const auth = useAuthStore(); 
  if (auth.token) {
    // 🔍 토큰 만료 확인
    if (isTokenExpired(auth.token)) {
      console.log( isRefreshing ? '토큰 갱신 중...' : '토큰 만료, 갱신 시도 중...');
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const newToken = await auth.refreshTokens();
          processQueue(null, newToken);
        } catch (error) {
          processQueue(error, null);
          auth.logout();
        } finally {
          isRefreshing = false;
        }
      }
      // 이미 갱신 중이면 큐에 넣고 기다리기
      await new Promise((resolve, reject) => {
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