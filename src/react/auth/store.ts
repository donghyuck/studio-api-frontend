import axios from "axios";
import { create } from "zustand";
import { API_BASE_URL } from "@/config/backend";
import type { UserDto } from "@/types/studio/user";
import { resolveAxiosError } from "@/utils/helpers";

export interface UserProfileDto extends UserDto {
  roles?: string[];
}

type BootstrapState = "idle" | "loading" | "ready";

interface AuthState {
  token: string | null;
  user: UserProfileDto | null;
  bootstrapState: BootstrapState;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  logoutEverywhere: () => Promise<void>;
  refreshTokens: () => Promise<string>;
  fetchUser: () => Promise<UserProfileDto>;
  initializeSession: () => Promise<boolean>;
  isExplicitlyLoggedOut: () => boolean;
  clearExplicitLogout: () => void;
  markExplicitLogout: () => void;
}

const loginUrl = `${API_BASE_URL}/api/auth/login`;
const refreshUrl = `${API_BASE_URL}/api/auth/refresh`;
const logoutUrl = `${API_BASE_URL}/api/auth/logout`;
const explicitLogoutKey = "auth.explicitLogout";

let restoreSessionPromise: Promise<boolean> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  bootstrapState: "idle",

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

  async login(username, password) {
    try {
      const response = await axios.post(
        loginUrl,
        { username, password },
        { withCredentials: true }
      );
      const accessToken = response.data?.data?.accessToken as string | undefined;
      if (!accessToken) {
        throw new Error("로그인 응답에 accessToken이 없습니다.");
      }
      set({ token: accessToken });
      get().clearExplicitLogout();
      await get().fetchUser();
    } catch (error) {
      throw new Error(resolveAxiosError(error) || "로그인 실패");
    }
  },

  logout() {
    set({ token: null, user: null });
  },

  async logoutEverywhere() {
    get().markExplicitLogout();
    try {
      await axios.post(logoutUrl, null, { withCredentials: true });
    } finally {
      get().logout();
      set({ bootstrapState: "ready" });
    }
  },

  async refreshTokens() {
    try {
      const response = await axios.post(refreshUrl, null, {
        withCredentials: true,
      });
      const accessToken = response.data?.data?.accessToken as string | undefined;
      if (!accessToken) {
        throw new Error("토큰 갱신 응답에 accessToken이 없습니다.");
      }
      set({ token: accessToken });
      get().clearExplicitLogout();
      return accessToken;
    } catch (error) {
      get().logout();
      throw new Error(resolveAxiosError(error) || "토큰 갱신 실패");
    }
  },

  async fetchUser() {
    try {
      const token = get().token;
      const response = await axios.get(`${API_BASE_URL}/api/self`, {
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const user = response.data?.data as UserProfileDto;
      set({ user });
      return user;
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        get().logout();
      }
      throw error;
    }
  },

  async initializeSession() {
    if (get().bootstrapState === "ready") {
      return !!get().token;
    }
    if (restoreSessionPromise) {
      return restoreSessionPromise;
    }

    set({ bootstrapState: "loading" });

    restoreSessionPromise = (async () => {
      try {
        if (get().isExplicitlyLoggedOut()) {
          get().logout();
          return false;
        }

        if (get().token) {
          if (get().user) return true;
          await get().fetchUser();
          return true;
        }

        await get().refreshTokens();
        await get().fetchUser();
        return !!get().token;
      } catch {
        get().logout();
        return false;
      } finally {
        set({ bootstrapState: "ready" });
        restoreSessionPromise = null;
      }
    })();

    return restoreSessionPromise;
  },
}));

export const authStore = useAuthStore;
