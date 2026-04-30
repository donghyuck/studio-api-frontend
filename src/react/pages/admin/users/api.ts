import { apiRequest } from "@/react/query/fetcher";
import type { RoleDto } from "@/react/pages/admin/datasource";
import type { UserDto, PasswordPolicyDto, ResetPasswordRequest } from "@/types/studio/user";

export interface UserRoleDto { roleId: number; name: string; description?: string | null; }
export interface CreateUserRequest {
  username: string;
  password: string;
  name: string;
  email: string;
}

export interface UserAvatarPresence {
  hasAvatar: boolean;
  count: number;
  primaryImageId?: number | null;
  primaryModifiedDate?: string | null;
}

export const reactUsersApi = {
  createUser: (payload: CreateUserRequest) =>
    apiRequest<number>("post", "/api/mgmt/users", { data: payload }),
  getUser: (userId: number) =>
    apiRequest<UserDto>("get", `/api/mgmt/users/${userId}`),
  updateUser: (userId: number, payload: Partial<UserDto>) =>
    apiRequest<UserDto>("put", `/api/mgmt/users/${userId}`, { data: payload }),
  deleteUser: (userId: number) =>
    apiRequest<void>("delete", `/api/mgmt/users/${userId}`),
  getUserRoles: (userId: number) =>
    apiRequest<UserRoleDto[]>("get", `/api/mgmt/users/${userId}/roles`),
  getUserDirectRoles: (userId: number) =>
    apiRequest<UserRoleDto[]>("get", `/api/mgmt/users/${userId}/roles`, {
      params: { by: "user" },
    }),
  getUserGroupRoles: (userId: number) =>
    apiRequest<UserRoleDto[]>("get", `/api/mgmt/users/${userId}/roles`, {
      params: { by: "group" },
    }),
  getAvailableRoles: (params?: { page?: number; size?: number; sort?: string }) =>
    apiRequest<{ content: RoleDto[]; totalElements: number }>("get", "/api/mgmt/roles", {
      params: {
        page: params?.page ?? 0,
        size: params?.size ?? 200,
        sort: params?.sort ?? "name,asc",
      },
    }),
  setUserRoles: (userId: number, roleIds: number[]) =>
    apiRequest<void>("post", `/api/mgmt/users/${userId}/roles`, { data: { roleIds } }),
  removeUserRole: (userId: number, roleId: number) =>
    apiRequest<void>("delete", `/api/mgmt/users/${userId}/roles/${roleId}`),
  getPasswordPolicy: () =>
    apiRequest<PasswordPolicyDto>("get", "/api/mgmt/users/password-policy"),
  resetPassword: (userId: number, payload: ResetPasswordRequest) =>
    apiRequest<void>("post", `/api/mgmt/users/${userId}/password`, { data: payload }),
  checkAvatarPresence: (userId: number) =>
    apiRequest<UserAvatarPresence>("get", `/api/mgmt/users/${userId}/avatars/exists`),
  uploadAvatar: (userId: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest<{ id?: number; imageId?: number }, FormData>(
      "post",
      `/api/mgmt/users/${userId}/avatars`,
      {
        headers: { "Content-Type": "multipart/form-data" },
        data: formData,
      }
    );
  },
  deleteAvatar: (userId: number, avatarId: number) =>
    apiRequest<void>("delete", `/api/mgmt/users/${userId}/avatars/${avatarId}`),
};
