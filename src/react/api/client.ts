import axios, { type InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL } from "@/config/backend";
import { parseJwtExp } from "@/utils/jwt";
import { authStore } from "@/react/auth/store";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

let isRefreshing = false;
let refreshQueue: Array<{
  resolve: () => void;
  reject: (error: unknown) => void;
}> = [];

function isTokenExpired(token: string, skewSeconds = 30) {
  const exp = parseJwtExp(token);
  if (!exp) return true;
  return exp < Math.floor(Date.now() / 1000) + skewSeconds;
}

function processRefreshQueue(error?: unknown) {
  refreshQueue.forEach((entry) => {
    if (error) {
      entry.reject(error);
      return;
    }
    entry.resolve();
  });
  refreshQueue = [];
}

async function ensureFreshAccessToken() {
  const state = authStore.getState();
  const token = state.token;

  if (!token || !isTokenExpired(token)) {
    return;
  }

  if (!isRefreshing) {
    isRefreshing = true;
    try {
      await state.refreshTokens();
      processRefreshQueue();
    } catch (error) {
      processRefreshQueue(error);
      state.logout();
      throw error;
    } finally {
      isRefreshing = false;
    }
    return;
  }

  await new Promise<void>((resolve, reject) => {
    refreshQueue.push({ resolve, reject });
  });
}

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    await ensureFreshAccessToken();
    const token = authStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  }
);
