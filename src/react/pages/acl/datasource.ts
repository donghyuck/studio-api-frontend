import { ReactPageDataSource } from "@/react/pages/admin/datasource";
import type {
  AclClassDto,
  AclEntryDto,
  AclObjectIdentityDto,
  AclSidDto,
} from "@/types/studio/acl";
import { reactAclApi } from "./api";

export class AclClassesDataSource extends ReactPageDataSource<AclClassDto> {
  constructor() {
    super("/api/security/acl/admin/classes");
  }

  override async fetchForAgGrid({ startRow, endRow, sortModel }: { startRow: number; endRow: number; sortModel?: { colId: string; sort: string }[]; }) {
    const size = endRow - startRow || this.pageSize;
    const page = Math.floor(startRow / size);
    const sort = sortModel && sortModel.length > 0 ? `${sortModel[0].colId},${sortModel[0].sort}` : undefined;
    const response = await reactAclApi.listClassesPage({ page, size, sort });
    return { rows: response.content, total: response.totalElements };
  }
}

export class AclSidsDataSource extends ReactPageDataSource<AclSidDto> {
  constructor() {
    super("/api/security/acl/admin/sids");
  }

  override async fetchForAgGrid({ startRow, endRow, sortModel }: { startRow: number; endRow: number; sortModel?: { colId: string; sort: string }[]; }) {
    const size = endRow - startRow || this.pageSize;
    const page = Math.floor(startRow / size);
    const sort = sortModel && sortModel.length > 0 ? `${sortModel[0].colId},${sortModel[0].sort}` : undefined;
    const response = await reactAclApi.listSidsPage({ page, size, sort });
    return { rows: response.content, total: response.totalElements };
  }
}

export class AclObjectsDataSource extends ReactPageDataSource<AclObjectIdentityDto> {
  constructor() {
    super("/api/security/acl/admin/objects");
  }

  override async fetchForAgGrid({ startRow, endRow, sortModel }: { startRow: number; endRow: number; sortModel?: { colId: string; sort: string }[]; }) {
    const size = endRow - startRow || this.pageSize;
    const page = Math.floor(startRow / size);
    const sort = sortModel && sortModel.length > 0 ? `${sortModel[0].colId},${sortModel[0].sort}` : undefined;
    const response = await reactAclApi.listObjectsPage({ page, size, sort });
    return { rows: response.content, total: response.totalElements };
  }
}

export class AclEntriesDataSource extends ReactPageDataSource<AclEntryDto> {
  constructor() {
    super("/api/security/acl/admin/entries");
  }

  override async fetchForAgGrid({ startRow, endRow, sortModel }: { startRow: number; endRow: number; sortModel?: { colId: string; sort: string }[]; }) {
    const size = endRow - startRow || this.pageSize;
    const page = Math.floor(startRow / size);
    const sort = sortModel && sortModel.length > 0 ? `${sortModel[0].colId},${sortModel[0].sort}` : undefined;
    const response = await reactAclApi.listEntriesPage({ page, size, sort });
    return { rows: response.content, total: response.totalElements };
  }
}
