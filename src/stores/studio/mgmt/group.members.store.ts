import { AbstractPageDataSource } from "@/data/datasource/abstract.page.datasource";
import type { CreateOptions, PageableDataSource } from "@/types/ag-gird";
import { api } from "@/data/http";
import { defineStore } from "pinia";

export interface GroupMemberDto {
  groupId: number;
  userId: number;
  username?: string;
  name?: string;
  email?: string | null;
  joinedAt?: string | null; // ISO
  joinedBy?: string | null;
}

/** 멤버 추가 페이로드 */
export interface AddMembersPayload {
  userIds: number[];
  joinedBy?: string;
}

export interface RemoveMembersPayload {
  userIds: number[];
}
 
type IPageableGroupMembersDataSource = PageableDataSource & {
  setGroupId(groupId: number): void;
  getGroupId(): number | undefined;

  addMembers(
    userIds: number[],
    opts?: CreateOptions & { refresh?: "none" | "current" | "first" }
  ): Promise<number>;

  removeMembers(userIds: number[]): Promise<number>; 
};

class PageableGroupMembersDataSource
  extends AbstractPageDataSource
  implements IPageableGroupMembersDataSource
{
  private groupId?: number;

  setGroupId(groupId: number) {
    this.groupId = groupId;
    // 컨텍스트 바뀌면 리스트/캐시 초기화
    this.dataItems.value = [];
    this.total.value = 0;
    this.page.value = 0;
  }
  getGroupId() {
    return this.groupId;
  }

  // API 엔드포인트 URL을 제공
  getFetchUrl(): string {
    if (!this.groupId) {
      throw new Error(
        "GroupMembers: groupId가 설정되지 않았습니다. setGroupId(gid) 호출이 필요합니다."
      );
    }
    return `/api/mgmt/groups/${this.groupId}/members`;
  }

  /** 멤버 일괄 추가 (서버가 count 또는 배열을 반환하더라도 대응) */
  async addMembers(
    userIds: number[],
    opts: CreateOptions & { refresh?: "none" | "current" | "first" } = {}
  ): Promise<number> {
    const { refresh = "none", optimistic = true } = opts;
    if (!userIds?.length) return 0;

    // POST /groups/{gid}/members  body: { userIds:[], joinedBy? }
    const res = await api.post<number>(
      this.getFetchUrl(),
      userIds
    );

    let affected = 0;
    // 새로고침 정책
    if (refresh === "current") {
      await this.fetch();
    } else if (refresh === "first") {
      this.setPage(0);
      await this.fetch();
    }
    return affected;
  }

  async removeMembers(
    userIds: number[],
    opts: { refresh?: "none" | "current" | "first" } = {}
  ): Promise<number> {
    const { refresh = "current" } = opts;
    if (!userIds?.length) return 0;

    
    let removed = await api.delete<number>(this.getFetchUrl(), userIds);

    if (refresh === "current") {
      await this.fetch();
    } else if (refresh === "first") {
      this.setPage(0);
      await this.fetch();
    }
    return removed;
  }
}

export const usePageableGroupMembersStore = defineStore(
  "mgmt-pageable-group-members-store",
  () => {
    const dataSource = new PageableGroupMembersDataSource();
    return {
      isLoaded: dataSource.isLoaded,
      loading: dataSource.loading,
      error: dataSource.error,
      dataItems: dataSource.dataItems,
      total: dataSource.total,
      pageSize: dataSource.pageSize,
      page: dataSource.page,
      setFilter: dataSource.setFilter.bind(dataSource),
      setPageSize: dataSource.setPageSize.bind(dataSource), 
      setSearch: dataSource.setSearch.bind(dataSource),
      setPage: dataSource.setPage.bind(dataSource),
      setSort: dataSource.setSort.bind(dataSource),
      fetch: dataSource.fetch.bind(dataSource),
      setGroupId: dataSource.setGroupId.bind(dataSource),
      getGroupId: dataSource.getGroupId.bind(dataSource),
      addMembers: dataSource.addMembers.bind(dataSource),
      removeMembers: dataSource.removeMembers.bind(dataSource),
    };
  }
);
