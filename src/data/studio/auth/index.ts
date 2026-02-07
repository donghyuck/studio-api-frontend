import { useAuthStore } from "@/stores/studio/mgmt/auth.store";
import { api } from "@/data/http";

const API_BASE = "/api/auth";

export function requestPasswordReset(email: string) {
  return api.post<void>(`${API_BASE}/password-reset/request`, { email });
}

export function validateResetToken(token: string) {
  return api.get<void>(`${API_BASE}/password-reset/validate`, { params: { token } });
}

export function confirmPasswordReset(token: string, password: string) {
  return api.post<void>(`${API_BASE}/password-reset/confirm`, { token, password });
}

export function authHeader(): Record<string, string> {
  // return authorization header with jwt token
  const auth = useAuthStore();
  if (auth?.token) {
    return { Authorization: "Bearer " + auth.token };
  } else {
    return {};
  }
}
