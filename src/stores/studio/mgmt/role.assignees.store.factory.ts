import { AbstractPageDataSource } from "@/data/datasource/abstract.page.datasource";
import type { PageableDataSource } from "@/types/ag-gird";
import { api } from "@/data/http";
import { defineStore } from "pinia";
import { computed, shallowRef } from "vue";
import type { RoleDto } from "./roles.store";

export type AssigneeScope = "group" | "user";

export interface RoleAssigneesContext {
  target: AssigneeScope; // 'group' | 'user'
  targetId: number; // groupId | userId
}

export interface BulkUpdateRequest {
  replace?: boolean;
  assign?: number[]; // 부여할 roleId 배열
  revoke?: number[]; // 회수할 roleId 배열
}

type IRoleAssigneesDataSource = PageableDataSource & {
  getContext(): RoleAssigneesContext;
  setContext(ctx: RoleAssigneesContext): void;
  update(roles: RoleDto[]): Promise<void>;
  assign( ids: number[] ): Promise<void>;
  revoke( ids: number[] ): Promise<void>;
};

class RoleAssigneesDataSource
  extends AbstractPageDataSource<RoleDto>
  implements IRoleAssigneesDataSource
{
  private ctx: RoleAssigneesContext;

  constructor(ctx: RoleAssigneesContext) {
    super();
    this.ctx = ctx;
  }

  setContext(ctx: RoleAssigneesContext) {
    this.ctx = ctx;
    this.dataItems.value = [];
    this.total.value = 0;
    this.page.value = 0;
  }

  getContext() {
    return this.ctx;
  }

  getFetchUrl(): string {
    if (!this.ctx) {
      throw new Error(
        "RoleGranted: Context 가 설정되지 않았습니다. setContext(ctx) 호출이 필요합니다."
      );
    }
    return this.baseUrlOf(this.ctx);
  }

  baseUrlOf(ctx: RoleAssigneesContext): string {
    const base = "/api/mgmt/roles";
    return ctx.target === "group"
      ? `${base}/${ctx.targetId}/groups`
      : `${base}/${ctx.targetId}/users`;
  }

  async update(roles: RoleDto[]): Promise<void> {
    await api.post(this.getFetchUrl(), roles);
  }

  async assign(ids: number[]): Promise<void> {
    await api.put(this.getFetchUrl(), ids);
  }

  async revoke(ids: number[]): Promise<void> {
    if (!ids?.length) return ;
    await api.delete(this.getFetchUrl(), ids);
  }
}

export const createRoleAssigneesStore = (id:string) =>
  defineStore(
  `mgmt-role-assignees-${id}-store` ,
  () => {
    
    const ctx = shallowRef<RoleAssigneesContext | null>(null);
    const ds = shallowRef<RoleAssigneesDataSource | null>(null);

    const isLoaded = computed(() => ds.value?.isLoaded.value ?? false);
    const loading = computed(() => ds.value?.loading.value ?? false);
    const error = computed(() => ds.value?.error.value ?? null);
    const dataItems = computed<RoleDto[]>(
      () => (ds.value?.dataItems.value ?? []) as RoleDto[]
    );
    const total = computed<number>(() => ds.value?.total.value ?? 0);
    const pageSize = computed<number>(() => ds.value?.pageSize.value ?? 15);
    const page = computed<number>(() => ds.value?.page.value ?? 0);

    function init(newCtx: RoleAssigneesContext) {
      ctx.value = newCtx;
      ds.value = new RoleAssigneesDataSource(newCtx);
    }

    function setContext(newCtx: RoleAssigneesContext) {
      if (!ds.value) {
        init(newCtx);
        return;
      }
      ctx.value = newCtx;
      ds.value.setContext(newCtx);
    }

    async function fetch() {
      if (!ds.value || !ctx.value) throw new Error("Context not initialized");
      await ds.value.fetch();
    }

    async function revoke(ids:number[]) {
      if (!ds.value || !ctx.value) throw new Error("Context not initialized");
      await ds.value.revoke(ids);
    }

    async function assign(ids:number[]) {
      if (!ds.value || !ctx.value) throw new Error("Context not initialized");
      await ds.value.assign(ids);
    }
  function setPageSize(p: number) {
      ds.value?.setPageSize(p);
    }
    function setPage(p: number) {
      ds.value?.setPage(p);
    }
    function setSearch(q?: string) {
      ds.value?.setSearch(q);
    }
    function setSort(s: any) {
      ds.value?.setSort(s);
    }
    function setFilter(f: any) {
      ds.value?.setFilter(f);
    }

    return {
      ctx,
      isLoaded,
      loading,
      error,
      dataItems,
      total,
      pageSize,
      page,
      setPageSize,
      init,
      setContext,
      fetch,
      revoke,
      assign,
      setPage,
      setSearch,
      setSort,
      setFilter,
    };
  }
);
