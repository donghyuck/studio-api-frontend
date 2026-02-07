import { AbstractPageDataSource } from "@/data/datasource/abstract.page.datasource";
import type { PageableDataSource } from "@/types/ag-gird";
import { api } from "@/data/http";
import { defineStore } from "pinia";

export interface AvatarPresence {
  hasAvatar: boolean;
  count: number;
  primaryImageId?: number | null;
  primaryModifiedDate?: string | null;
}

export interface AvatarDto {
  id: number;
  userId: number;
  primaryImage: boolean;
  fileName: string;
  fileSize: number;
  contentType?: string | null;
  creationDate?: string | null;
  modifiedDate?: string | null;
}

type IUserAvatarsDataSource = PageableDataSource & {
  setUserId(groupId: number): void;
  getUserId(): number | undefined;
  setPrimary(avatar: AvatarDto): Promise<void>;
  delete(id: number): Promise<void>;
  checkPresence(): Promise<AvatarPresence>;
};

class UserAvatarsDataSource
  extends AbstractPageDataSource
  implements IUserAvatarsDataSource
{
  private userId?: number;

  constructor() {
    super("data", "totalElements");
  }

  setUserId(userId: number) {
    this.userId = userId;
    this.dataItems.value = [];
    this.total.value = 0;
    this.page.value = 0;
  }

  getUserId() {
    return this.userId;
  }

  async setPrimary(avatar: AvatarDto): Promise<void> {
    if (!this.userId) {
      throw new Error(
        "userId가 설정되지 않았습니다. setUserId(userId)를 먼저 호출하세요."
      );
    }
    await api.put(`${this.getFetchUrl()}/${avatar.id}/primary`);
  }

  async delete(id: number): Promise<void> {
    if (!this.userId) {
      throw new Error(
        "userId가 설정되지 않았습니다. setUserId(userId)를 먼저 호출하세요."
      );
    }
    await api.delete(`${this.getFetchUrl()}/${id}`);
  }

  async checkPresence(): Promise<AvatarPresence> {
    if (!this.userId) {
      throw new Error(
        "userId가 설정되지 않았습니다. setUserId(userId)를 먼저 호출하세요."
      );
    }
    const res = await api.get<AvatarPresence>(`${this.getFetchUrl()}/exists`);
    return res;
  }

  getFetchUrl(): string {
    if (!this.userId) {
      throw new Error(
        "UserAvatars : userId가 설정되지 않았습니다. setUserId(gid) 호출이 필요합니다."
      );
    }
    return `/api/mgmt/users/${this.userId}/avatars`;
  }
}

export const useUserAvatarsStore = (id: number) =>
  defineStore(`mgmt-user-avatars-${id}-store`, () => {
    const dataSource = new UserAvatarsDataSource();
    dataSource.setUserId(id);
    return {
      isLoaded: dataSource.isLoaded,
      loading: dataSource.loading,
      error: dataSource.error,
      dataItems: dataSource.dataItems,
      total: dataSource.total,
      pageSize: dataSource.pageSize,
      page: dataSource.page,
      setPageSize: dataSource.setPageSize.bind(dataSource),
      setSearch: dataSource.setSearch.bind(dataSource),
      setPage: dataSource.setPage.bind(dataSource),
      setSort: dataSource.setSort.bind(dataSource),
      setFilter: dataSource.setFilter.bind(dataSource),
      fetch: dataSource.fetch.bind(dataSource),
      getUser: dataSource.getUserId.bind(dataSource),
      setPrimary: dataSource.setPrimary.bind(dataSource),
      delete: dataSource.delete.bind(dataSource),
      checkPresence: dataSource.checkPresence.bind(dataSource),
    };
  });
