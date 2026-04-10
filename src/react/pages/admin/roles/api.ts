import { apiRequest } from "@/react/query/fetcher";
import type { GroupDto, RoleDto } from "@/react/pages/admin/datasource";
import type { UserDto } from "@/types/studio/user";
import type { PageResponse } from "@/types/studio/api-common";

export interface GrantedGroupDto {
  groupId: number;
  name: string;
  description?: string | null;
  memberCount?: number;
}

async function batchRequests(requests: Array<Promise<void>>) {
  if (requests.length === 0) {
    return;
  }

  await Promise.all(requests);
}

export const reactRolesApi = {
  getRole: (roleId: number) =>
    apiRequest<RoleDto>("get", `/api/mgmt/roles/${roleId}`),
  updateRole: (roleId: number, payload: Partial<RoleDto>) =>
    apiRequest<RoleDto>("put", `/api/mgmt/roles/${roleId}`, { data: payload }),
  createRole: (payload: { name: string; description?: string }) =>
    apiRequest<RoleDto>("post", "/api/mgmt/roles", { data: payload }),
  searchUsers: (params?: { q?: string; page?: number; size?: number }) =>
    apiRequest<PageResponse<UserDto>>("get", "/api/mgmt/users", {
      params: {
        q: params?.q,
        in: params?.q ? "username,name,email" : undefined,
        page: params?.page ?? 0,
        size: params?.size ?? 15,
      },
    }),
  getGrantedUsers: (roleId: number) =>
    apiRequest<UserDto[]>("get", `/api/mgmt/roles/${roleId}/users`),
  addUser: (roleId: number, userId: number) =>
    apiRequest<void>("post", `/api/mgmt/roles/${roleId}/users`, { data: { userId } }),
  removeUser: (roleId: number, userId: number) =>
    apiRequest<void>("delete", `/api/mgmt/roles/${roleId}/users/${userId}`),
  assignUsers: (roleId: number, userIds: number[]) =>
    batchRequests(userIds.map((userId) => reactRolesApi.addUser(roleId, userId))),
  revokeUsers: (roleId: number, userIds: number[]) =>
    batchRequests(userIds.map((userId) => reactRolesApi.removeUser(roleId, userId))),
  searchGroups: (params?: { q?: string; page?: number; size?: number }) =>
    apiRequest<PageResponse<GroupDto>>("get", "/api/mgmt/groups", {
      params: {
        q: params?.q,
        page: params?.page ?? 0,
        size: params?.size ?? 15,
      },
    }),
  getGrantedGroups: (roleId: number) =>
    apiRequest<GrantedGroupDto[]>("get", `/api/mgmt/roles/${roleId}/groups`),
  addGroup: (roleId: number, groupId: number) =>
    apiRequest<void>("post", `/api/mgmt/roles/${roleId}/groups`, { data: { groupId } }),
  removeGroup: (roleId: number, groupId: number) =>
    apiRequest<void>("delete", `/api/mgmt/roles/${roleId}/groups/${groupId}`),
  assignGroups: (roleId: number, groupIds: number[]) =>
    batchRequests(groupIds.map((groupId) => reactRolesApi.addGroup(roleId, groupId))),
  revokeGroups: (roleId: number, groupIds: number[]) =>
    batchRequests(groupIds.map((groupId) => reactRolesApi.removeGroup(roleId, groupId))),
};
