import { useAuthStore } from "@/stores/studio/mgmt/auth.store";
import { api } from "@/data/http";
import type { MeProfileDto, MeProfilePatchRequest, PasswordPolicyDto } from "@/types/studio/user";

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

export function changeSelfPassword(currentPassword: string, newPassword: string) {
  return api.put<void>("/api/self/password", { currentPassword, newPassword });
}

export function getSelfPasswordPolicy() {
  return api.get<PasswordPolicyDto>("/api/self/password-policy");
}

export function getPublicPasswordPolicy() {
  return api.get<PasswordPolicyDto>("/api/public/auth/password-policy");
}

export function getSelfProfile() {
  return api.get<MeProfileDto>("/api/self");
}

export function patchSelfProfile(payload: MeProfilePatchRequest) {
  return api.patch<MeProfileDto>("/api/self", payload);
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
