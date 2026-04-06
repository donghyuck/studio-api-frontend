import { apiRequest } from "@/react/query/fetcher";
import type { UserDto, PasswordPolicyDto, ResetPasswordRequest } from "@/types/studio/user";

export interface UserRoleDto { roleId: number; name: string; description?: string | null; }

export const reactUsersApi = {
  getUser: (userId: number) =>
    apiRequest<UserDto>("get", `/api/mgmt/users/${userId}`),
  updateUser: (userId: number, payload: Partial<UserDto>) =>
    apiRequest<UserDto>("put", `/api/mgmt/users/${userId}`, { data: payload }),
  getUserRoles: (userId: number) =>
    apiRequest<UserRoleDto[]>("get", `/api/mgmt/users/${userId}/roles`),
  addUserRole: (userId: number, roleId: number) =>
    apiRequest<void>("post", `/api/mgmt/users/${userId}/roles`, { data: { roleId } }),
  removeUserRole: (userId: number, roleId: number) =>
    apiRequest<void>("delete", `/api/mgmt/users/${userId}/roles/${roleId}`),
  getPasswordPolicy: () =>
    apiRequest<PasswordPolicyDto>("get", "/api/mgmt/users/password-policy"),
  resetPassword: (userId: number, payload: ResetPasswordRequest) =>
    apiRequest<void>("post", `/api/mgmt/users/${userId}/password`, { data: payload }),
};
