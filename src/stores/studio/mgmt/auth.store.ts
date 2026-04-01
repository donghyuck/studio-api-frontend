// src/stores/greentogether/auth.ts
import api from "@/plugins/axios";
import type { UserDto } from "@/types/studio/user";
import { resolveAxiosError } from "@/utils/helpers";
import axios from "axios";
import { defineStore } from "pinia"; 
import { API_BASE_URL } from "@/config/backend";

export interface UserProfileDto extends UserDto {
  roles?: string[];
}

const loginUrl = `${API_BASE_URL}/api/auth/login`;
const refreshUrl = `${API_BASE_URL}/api/auth/refresh`;
const logoutUrl = `${API_BASE_URL}/api/auth/logout`;
const explicitLogoutKey = "auth.explicitLogout";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    token: null as string | null,
    user : null as UserProfileDto | null,
  }),
  getters: {
    isAuthenticated: (state) => !!state.token,
    profileImageUrl: (state) =>
      state.user?.username
        ? `${API_BASE_URL}/api/profile/${encodeURIComponent(
            state.user.username
          )}/avatar`
        : "",
  },

  actions: {
    isExplicitlyLoggedOut() {
      if (typeof window === "undefined") return false;
      return window.localStorage.getItem(explicitLogoutKey) === "1";
    },

    clearExplicitLogout() {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(explicitLogoutKey);
    },

    markExplicitLogout() {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(explicitLogoutKey, "1");
    },

    async login(username: string, password: string) {
      try {
        const response = await axios.post(
          loginUrl,
          { username, password },
          {
            withCredentials: true, // Refresh Token이 HttpOnly 쿠키로 전송되도록
          }
        );
        const { accessToken } = response.data.data;
        this.token = accessToken;
        this.clearExplicitLogout();
        await this.fetchUser();
      } catch (error: any) {  
          const message = resolveAxiosError(error);
          throw new Error( message || "로그인 실패" );
      }
    },
    logout() {
      this.token = null;
      this.user = null;
    },

    async logoutEverywhere() {
      this.markExplicitLogout();
      try {
        await axios.post(logoutUrl, null, {
          withCredentials: true,
        });
      } catch (error) {
        console.warn("서버 로그아웃 요청 실패", error);
      } finally {
        this.logout();
      }
    },

    async refreshTokens() {
      try {
        const response = await axios.post(refreshUrl, null, {
          withCredentials: true, // 쿠키 자동 전송
        });

        const { accessToken } = response.data.data;
        this.token = accessToken;

        return accessToken;
      } catch (error: any) {
        this.logout();
        throw new Error(resolveAxiosError(error) || "토큰 갱신 실패");
      }
    },

    async fetchUser() {
      try {
        const response = await api.get("/api/self");
        this.user = response.data.data as UserProfileDto;
      } catch (error: any) {
        const status = error?.response?.status;
        if (status === 401 || status === 403) {
          this.logout(); // 인증 불가 → 로그아웃
        } else {
          console.warn("fetchUser 실패 (네트워크/서버 문제)", error);
          // 로그인 상태는 유지하되 UI에 경고 표시 가능
        }
        throw error; // 라우터 가드 등에서 처리를 위해 예외 재전달
      }
    },
  },
});
