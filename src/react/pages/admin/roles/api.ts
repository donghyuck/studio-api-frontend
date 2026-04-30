import { apiRequest } from "@/react/query/fetcher";
import type { GroupDto, RoleDto } from "@/react/pages/admin/datasource";
import type { UserDto } from "@/types/studio/user";
import type { PageResponse } from "@/types/studio/api-common";
import { reactGroupsApi } from "@/react/pages/admin/groups/api";

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

async function updateGroupRoleMembership(
  groupId: number,
  roleId: number,
  mode: "assign" | "revoke"
) {
  const currentRoles = await reactGroupsApi.getGroupRoles(groupId);
  const currentRoleIds = currentRoles
    .map((role) => role.roleId)
    .filter((id): id is number => typeof id === "number");
  const nextRoleIds =
    mode === "assign"
      ? Array.from(new Set([...currentRoleIds, roleId]))
      : currentRoleIds.filter((currentRoleId) => currentRoleId !== roleId);

  await reactGroupsApi.setGroupRoles(groupId, nextRoleIds);
}

function unwrapArrayPayload<T>(payload: T[] | PageResponse<T>) {
  if (Array.isArray(payload)) {
    return payload;
  }

  return payload.content ?? [];
}

export const reactRolesApi = {
  getRole: (roleId: number) =>
    apiRequest<RoleDto>("get", `/api/mgmt/roles/${roleId}`),
  updateRole: (roleId: number, payload: Partial<RoleDto>) =>
    apiRequest<RoleDto>("put", `/api/mgmt/roles/${roleId}`, { data: payload }),
  createRole: (payload: { name: string; description?: string }) =>
    apiRequest<RoleDto>("post", "/api/mgmt/roles", { data: payload }),
  deleteRole: (roleId: number) =>
    apiRequest<void>("delete", `/api/mgmt/roles/${roleId}`),
  searchUsers: (params?: { q?: string; page?: number; size?: number }) =>
    apiRequest<PageResponse<UserDto>>("get", "/api/mgmt/users", {
      params: {
        q: params?.q,
        in: params?.q ? "username,name,email" : undefined,
        page: params?.page ?? 0,
        size: params?.size ?? 15,
      },
    }),
  getGrantedUsers: async (roleId: number) =>
    unwrapArrayPayload(
      await apiRequest<UserDto[] | PageResponse<UserDto>>(
        "get",
        `/api/mgmt/roles/${roleId}/users`
      )
    ),
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
  getGrantedGroups: async (roleId: number) =>
    unwrapArrayPayload(
      await apiRequest<GrantedGroupDto[] | PageResponse<GrantedGroupDto>>(
        "get",
        `/api/mgmt/roles/${roleId}/groups`
      )
    ),
  addGroup: (roleId: number, groupId: number) =>
    updateGroupRoleMembership(groupId, roleId, "assign"),
  removeGroup: (roleId: number, groupId: number) =>
    updateGroupRoleMembership(groupId, roleId, "revoke"),
  assignGroups: (roleId: number, groupIds: number[]) =>
    batchRequests(groupIds.map((groupId) => reactRolesApi.addGroup(roleId, groupId))),
  revokeGroups: (roleId: number, groupIds: number[]) =>
    batchRequests(groupIds.map((groupId) => reactRolesApi.removeGroup(roleId, groupId))),
};
