import { apiRequest } from "@/react/query/fetcher";
import type { RoleDto } from "@/react/pages/admin/datasource";
import type { UserDto } from "@/types/studio/user";

export const reactRolesApi = {
  getRole: (roleId: number) =>
    apiRequest<RoleDto>("get", `/api/mgmt/roles/${roleId}`),
  updateRole: (roleId: number, payload: Partial<RoleDto>) =>
    apiRequest<RoleDto>("put", `/api/mgmt/roles/${roleId}`, { data: payload }),
  createRole: (payload: { name: string; description?: string }) =>
    apiRequest<RoleDto>("post", "/api/mgmt/roles", { data: payload }),
  getGrantedUsers: (roleId: number) =>
    apiRequest<UserDto[]>("get", `/api/mgmt/roles/${roleId}/users`),
  addUser: (roleId: number, userId: number) =>
    apiRequest<void>("post", `/api/mgmt/roles/${roleId}/users`, { data: { userId } }),
  removeUser: (roleId: number, userId: number) =>
    apiRequest<void>("delete", `/api/mgmt/roles/${roleId}/users/${userId}`),
  getGrantedGroups: (roleId: number) =>
    apiRequest<{ groupId: number; name: string }[]>("get", `/api/mgmt/roles/${roleId}/groups`),
  addGroup: (roleId: number, groupId: number) =>
    apiRequest<void>("post", `/api/mgmt/roles/${roleId}/groups`, { data: { groupId } }),
  removeGroup: (roleId: number, groupId: number) =>
    apiRequest<void>("delete", `/api/mgmt/roles/${roleId}/groups/${groupId}`),
};
