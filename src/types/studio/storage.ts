export interface ObjectListItemDto {
  key: string;
  size?: number;
  contentType?: string;
  eTag?: string;
  lastModified?: string; // ISO
  folder: boolean;
}

export interface ObjectListResponse {
  bucket: string;
  prefix?: string | null;
  delimiter?: string | null;
  commonPrefixes: string[];
  items: ObjectListItemDto[];
  nextToken?: string | null;
  truncated: boolean;
}

export interface ProviderDto {
  name: string;
  type: string;
  enabled: boolean;
  health: string;
  region: string;
  endpointMasked: string | null;
  ociNamespace: string | null;
  ociCompartmentMasked: string | null;
  fsRootMasked?: string | null;
  s3PathStyle: boolean;
  s3PresignerEnabled: boolean;
  capabilities: [];
  labels: string | null;
}

export interface BucketDto {
  objectStorageType: string;
  providerId: string;
  bucket: string;
  namespace: string| null;
  compartmentId: string | null;
  createdDate: Date | null; 
}

export interface ObjectListResult {
  rows: ObjectListItemDto[];
  total: number;
  lastRow: number;
  nextToken?: string | null;
  truncated?: boolean;
}

export interface ObjectInfoDto {
    bucket:string;
    key:string;
    name?:string;
    size?: number;
    eTag?: string;
    contentType?: string;
    createdDate?:Date | null; 
    modifiedDate?:Date | null; 
    folder: boolean;
    metadata?: Record<string, any>; 
}

export interface PresignedUrlDto {
    url:string; 
    expiresAt:Date | null;  
}

export interface BreadcrumbItem {
  label: string;
  prefix: string;
  disabled?: boolean;
}

export interface BuildBreadcrumbOptions {
  rootLabel?: string;
  rootDisabled?: boolean;
  lastDisabled?: boolean;
  decodeLabel?: boolean;
  maxDepth?: number;
}
