import {
  buildBreadcrumb,
  fetchBuckets,
  fetchObjectHead,
  fetchObjects,
  hasMore,
  presignGet,
  toRows,
} from "@/data/studio/mgmt/storage";
import { AbstractPageDataSource } from "@/data/datasource/abstract.page.datasource";
import type { PageableDataSource } from "@/types/ag-gird";
import type {
  BucketDto,
  ObjectInfoDto,
  ObjectListItemDto,
  ObjectListResult,
  PresignedUrlDto
} from "@/types/studio/storage";
import { defineStore } from "pinia";

type IObjectStorageDataSource = PageableDataSource & {
  setContext(ctx: {
    bucket: string;
    prefix?: string;
    pageSize?: number;
    delimiter?: string;
  }): void;
  setProviderId(providerId: string): void;
  getProviderId(): string | undefined;
  getPrefix(): string;
  getBuckets(): Promise<BucketDto[]>;
  getObjects(): Promise<{
    rows: ObjectListItemDto[];
    total: number;
    lastRow: number;
  }>;
  getObjectHead(key: string):Promise<ObjectInfoDto>;
  getPresignedUrl(key: string, opts?: {
    ttlSeconds?: number; contentType?: string; disposition?: string;
  }): Promise<PresignedUrlDto> ;
};

export class ObjectStorageDataSource
  extends AbstractPageDataSource
  implements IObjectStorageDataSource
{
  private providerId: string|undefined;
  private bucket = "";
  private prefix = "";
  private delimiter = "/";
  private folders: string[] = []; // 첫 페이지 commonPrefixes
  private nextToken: string | null = null; // 다음 커서
  private truncated = false; // 다음 페이지 존재 여부 

  getPrefix(): string {
    return this.prefix;
  }

  /**
   *
   * @param ctx
   */
  public setContext(ctx: {
    bucket: string;
    prefix?: string;
    pageSize?: number;
    delimiter?: string;
  }) {
    this.bucket = ctx.bucket;
    this.prefix = ctx.prefix ?? "";
    if (ctx.pageSize)
      super.setPageSize(Math.max(1, Math.min(1000, ctx.pageSize)));
    if (ctx.delimiter) this.delimiter = ctx.delimiter || "/";
    this.reset();
  }

  private reset() {
    this.folders = [];
    this.nextToken = null;
    this.truncated = false;
    this.isLoaded.value = false;
    super.setPage(0);
  }

  setProviderId(providerId: string) {
    this.providerId = providerId;
  }
  getProviderId() {
    return this.providerId;
  }

  async getBuckets(): Promise<BucketDto[]> {
    if (!this.providerId) {
      throw new Error(
        "ObjectStorage: providerId가 설정되지 않았습니다. setProviderId(gid) 호출이 필요합니다."
      );
    }
    const payload = await fetchBuckets({ providerId: this.providerId });
    return payload;
  }

  getFetchUrl(): string {
    if (!this.providerId) {
      throw new Error(
        "ObjectStorage: providerId가 설정되지 않았습니다. setProviderId(gid) 호출이 필요합니다."
      );
    }
    return `/api/mgmt/objectstorage/providers/${this.providerId}/`;
  }
 
  async getObjectHead(key: string): Promise<ObjectInfoDto> { 
    this.checkAll();
    const providerId = this.providerId as string;
    const bucket = this.bucket;
    return await fetchObjectHead({ providerId, bucket, key: key });
  }

  async getPresignedUrl(key: string, opts?: { ttl?: number; contentType?: string; disposition?: "inline" | "attachment";
  }): Promise<PresignedUrlDto> {
     this.checkAll();
    const providerId = this.providerId as string;
    const bucket = this.bucket;
    return await presignGet({ providerId, bucket, key: key, ...opts });
  }

  public async refresh(): Promise<void> {
    this.reset();
    await this.fetch();
    (this as any).notifyRefreshed?.();
  }

  async fetch(): Promise<void> { 
    if (!this.bucket) {
      return;
    }
    try {
      const data = await this.load_by_page({
        page: this.page.value,
        size: this.pageSize.value
      });
      this.dataItems.value = [...data.rows];
      this.total.value = data.total;
    } finally {
      this.isLoaded.value = true;
    }
  }

  public async getObjects(): Promise<{
    rows: ObjectListItemDto[];
    total: number;
    lastRow: number;
  }> {   
    const data = await this.load_by_page({
      page: this.page.value,
      size: this.pageSize.value,
      includeFolders: true,
    });
    return { rows: data.rows, total: data.total, lastRow: data.lastRow };
  }

  public async load_by_page(opts?: {
    page?: number;
    size?: number;
    includeFolders?: boolean;
  }): Promise<ObjectListResult> {
    this.checkAll();
    const page = Math.max(0, opts?.page ?? 0);
    const size = Math.max(1, Math.min(1000, opts?.size ?? this.pageSize.value));
    const includeFolders = opts?.includeFolders ?? true;
    let token: string | null = null;
    for (let i = 0; i < page; i++) {
      const skipRes = await fetchObjects({
        providerId: this.providerId!,
        bucket: this.bucket,
        prefix: this.prefix || null,
        delimiter: this.delimiter,
        token,
        size,
      });
      if (!skipRes.nextToken) {
        return {
          rows: [],
          total: -1,
          lastRow: 0,
          nextToken: null,
          truncated: false,
        };
      }
      token = skipRes.nextToken;
    }
    const res = await fetchObjects({
      providerId: this.providerId!,
      bucket: this.bucket,
      prefix: this.prefix || null,
      delimiter: this.delimiter,
      token,
      size,
    });
    const rows = toRows(res, includeFolders);
    const hasNext = !!res.truncated && !!res.nextToken;
    const lastRow = hasNext ? -1 : rows.length;
    return {
      rows,
      total: -1,
      lastRow,
      nextToken: res.nextToken ?? null,
      truncated: !!res.truncated,
    };
  }

  private checkAll(): void {
    if (!this.providerId) {
      throw new Error(
        "ObjectStorage: providerId가 설정되지 않았습니다. setProviderId(id)/setContxt(ctx) 호출이 필요합니다."
      );
    }
    if (!this.bucket) {
      throw new Error(
        "ObjectStorage: bucket 이 설정되지 않았습니다. setContxt(ctx) 호출이 필요합니다."
      );
    }
  }

  hasMore() {
    return hasMore(this.truncated, this.nextToken);
  }

  breadcrumb() {
    return buildBreadcrumb(this.prefix);
  }

}

export const useObjectStorageStore = defineStore(
  "mgmt-object-storage-store",
  () => {
    const dataSource = new ObjectStorageDataSource();
    return {
      isLoaded: dataSource.isLoaded,
      loading: dataSource.loading,
      error: dataSource.error,
      dataItems: dataSource.dataItems,
      total: dataSource.total, 
      pageSize: dataSource.pageSize, 
      page: dataSource.page,
      getBuckets: dataSource.getBuckets.bind(dataSource),
      setPageSize: dataSource.setPageSize.bind(dataSource),
      setSearch: dataSource.setSearch.bind(dataSource),
      setFilter: dataSource.setFilter.bind(dataSource),
      getPage:dataSource.getPage.bind(dataSource),
      setPage: dataSource.setPage.bind(dataSource),
      setSort: dataSource.setSort.bind(dataSource),
      fetch: dataSource.fetch.bind(dataSource),
      setProviderId: dataSource.setProviderId.bind(dataSource),
      getProviderId: dataSource.getProviderId.bind(dataSource),
      setContext: dataSource.setContext.bind(dataSource),
      refresh: dataSource.refresh.bind(dataSource),
      getObjects: dataSource.getObjects.bind(dataSource),
      getPrefix: dataSource.getPrefix.bind(dataSource),
      breadcrumb: dataSource.breadcrumb.bind(dataSource),
      hasMore: dataSource.hasMore.bind(dataSource),
    };
  }
);
