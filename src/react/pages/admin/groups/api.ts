import { apiRequest } from "@/react/query/fetcher";
import type { GroupDto, RoleDto } from "@/react/pages/admin/datasource";
import type { PageResponse } from "@/types/studio/api-common";

export interface GroupMemberDto {
  groupId?: number;
  userId: number;
  username?: string;
  name?: string;
  email?: string | null;
  role?: string;
  joinedAt?: string | null;
  joinedBy?: string | null;
  enabled?: boolean;
}

type GroupMemberIdsPayload = {
  userIds: number[];
};

function unwrapMemberList(payload: GroupMemberDto[] | PageResponse<GroupMemberDto>) {
  if (Array.isArray(payload)) {
    return payload;
  }

  return payload.content ?? [];
}

export const reactGroupsApi = {
  getGroup: (groupId: number) =>
    apiRequest<GroupDto>("get", `/api/mgmt/groups/${groupId}`),
  updateGroup: (groupId: number, payload: Partial<GroupDto>) =>
    apiRequest<GroupDto>("put", `/api/mgmt/groups/${groupId}`, { data: payload }),
  createGroup: (payload: { name: string; description?: string }) =>
    apiRequest<GroupDto>("post", "/api/mgmt/groups", { data: payload }),
  deleteGroup: (groupId: number) =>
    apiRequest<void>("delete", `/api/mgmt/groups/${groupId}`),
  getMemberSummaries: (
    groupId: number,
    params?: { q?: string; page?: number; size?: number; sort?: string }
  ) =>
    apiRequest<PageResponse<GroupMemberDto>>(
      "get",
      `/api/mgmt/groups/${groupId}/member-summaries`,
      {
        params: {
          q: params?.q,
          page: params?.page ?? 0,
          size: params?.size ?? 20,
          sort: params?.sort,
        },
      }
    ),
  getMembers: async (groupId: number) =>
    unwrapMemberList(
      await apiRequest<GroupMemberDto[] | PageResponse<GroupMemberDto>>(
        "get",
        `/api/mgmt/groups/${groupId}/member-summaries`
      )
    ),
  addMembers: (groupId: number, userIds: number[]) =>
    apiRequest<void>("post", `/api/mgmt/groups/${groupId}/members`, {
      data: { userIds } satisfies GroupMemberIdsPayload,
    }),
  removeMembers: (groupId: number, userIds: number[]) =>
    apiRequest<void>("delete", `/api/mgmt/groups/${groupId}/members`, {
      data: { userIds } satisfies GroupMemberIdsPayload,
    }),
  getGroupRoles: (groupId: number) =>
    apiRequest<{ roleId: number; name: string }[]>("get", `/api/mgmt/groups/${groupId}/roles`),
  getAvailableRoles: (params?: { page?: number; size?: number; sort?: string }) =>
    apiRequest<{ content: RoleDto[]; totalElements: number }>("get", "/api/mgmt/roles", {
      params: {
        page: params?.page ?? 0,
        size: params?.size ?? 200,
        sort: params?.sort ?? "name,asc",
      },
    }),
  setGroupRoles: (groupId: number, roleIds: number[]) =>
    apiRequest<void>("post", `/api/mgmt/groups/${groupId}/roles`, {
      data: { roleIds },
    }),
  removeGroupRole: (groupId: number, roleId: number) =>
    apiRequest<void>("delete", `/api/mgmt/groups/${groupId}/roles/${roleId}`),
};
