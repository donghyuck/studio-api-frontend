// utils/axios.ts
import axios from 'axios';
import { useAuthStore } from '@/stores/pem/auth.store';

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

// 요청 인터셉터 - 자동 헤더 추가
instance.interceptors.request.use((config) => {
  const store = useAuthStore();
  if (store.accessToken) {
    config.headers.Authorization = `Bearer ${store.accessToken}`;
  }
  return config;
});

// 응답 인터셉터 - 토큰 만료 감지 → refresh 요청
instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const store = useAuthStore();
      try {
        await store.refresh();
        originalRequest.headers.Authorization = `Bearer ${store.accessToken}`;
        return instance(originalRequest);
      } catch (e) {
        store.logout();
      }
    }
    return Promise.reject(error);
  }
);
