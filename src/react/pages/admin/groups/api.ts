import { apiRequest } from "@/react/query/fetcher";
import type { GroupDto } from "@/react/pages/admin/datasource";

export interface GroupMemberDto { userId: number; username: string; name: string; role?: string; joinedAt?: string; }

export const reactGroupsApi = {
  getGroup: (groupId: number) =>
    apiRequest<GroupDto>("get", `/api/mgmt/groups/${groupId}`),
  updateGroup: (groupId: number, payload: Partial<GroupDto>) =>
    apiRequest<GroupDto>("put", `/api/mgmt/groups/${groupId}`, { data: payload }),
  createGroup: (payload: { name: string; description?: string }) =>
    apiRequest<GroupDto>("post", "/api/mgmt/groups", { data: payload }),
  getMembers: (groupId: number) =>
    apiRequest<GroupMemberDto[]>("get", `/api/mgmt/groups/${groupId}/members`),
  addMember: (groupId: number, userId: number) =>
    apiRequest<void>("post", `/api/mgmt/groups/${groupId}/members`, { data: { userId } }),
  removeMember: (groupId: number, userId: number) =>
    apiRequest<void>("delete", `/api/mgmt/groups/${groupId}/members/${userId}`),
  getGroupRoles: (groupId: number) =>
    apiRequest<{ roleId: number; name: string }[]>("get", `/api/mgmt/groups/${groupId}/roles`),
  addGroupRole: (groupId: number, roleId: number) =>
    apiRequest<void>("post", `/api/mgmt/groups/${groupId}/roles`, { data: { roleId } }),
  removeGroupRole: (groupId: number, roleId: number) =>
    apiRequest<void>("delete", `/api/mgmt/groups/${groupId}/roles/${roleId}`),
};
