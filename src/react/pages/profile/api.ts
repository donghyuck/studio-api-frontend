import { apiRequest } from "@/react/query/fetcher";
import type { MeProfileDto, MeProfilePatchRequest, PasswordPolicyDto } from "@/types/studio/user";

export const reactProfileApi = {
  getProfile: () =>
    apiRequest<MeProfileDto>("get", "/api/self"),
  updateProfile: (payload: MeProfilePatchRequest) =>
    apiRequest<MeProfileDto>("patch", "/api/self", { data: payload }),
  getPasswordPolicy: () =>
    apiRequest<PasswordPolicyDto>("get", "/api/self/password-policy"),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiRequest<void>("post", "/api/self/password", { data: { currentPassword, newPassword } }),
};
