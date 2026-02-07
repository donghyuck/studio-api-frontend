export type ObjectTypeStatus = "ACTIVE" | "DEPRECATED" | "DISABLED";

export interface ObjectTypeDto {
  objectType: number;
  code: string;
  name: string;
  domain: string;
  status: ObjectTypeStatus | string;
  description?: string | null;
  createdBy?: string | null;
  createdById?: number | null;
  createdAt?: string | null;
  updatedBy?: string | null;
  updatedById?: number | null;
  updatedAt?: string | null;
}

export interface ObjectTypePolicyDto {
  objectType: number;
  maxFileMb?: number | null;
  allowedExt?: string | null;
  allowedMime?: string | null;
  policyJson?: string | null;
  createdBy?: string | null;
  createdById?: number | null;
  createdAt?: string | null;
  updatedBy?: string | null;
  updatedById?: number | null;
  updatedAt?: string | null;
}

export interface ObjectTypeDefinitionDto {
  type: ObjectTypeDto;
  policy?: ObjectTypePolicyDto | null;
}

export interface ValidateUploadRequest {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface ValidateUploadResponse {
  allowed: boolean;
  reason?: string | null;
}

export interface ObjectTypeUpsertRequest {
  objectType?: number | null;
  code: string;
  name: string;
  domain: string;
  status: ObjectTypeStatus | string;
  description?: string | null;
  updatedBy: string;
  updatedById: number;
  createdBy: string;
  createdById: number;
}

export interface ObjectTypePatchRequest {
  code?: string | null;
  name?: string | null;
  domain?: string | null;
  status?: ObjectTypeStatus | string | null;
  description?: string | null;
  updatedBy: string;
  updatedById: number;
}

export interface ObjectTypePolicyUpsertRequest {
  maxFileMb?: number | null;
  allowedExt?: string | null;
  allowedMime?: string | null;
  policyJson?: string | null;
  updatedBy: string;
  updatedById: number;
  createdBy: string;
  createdById: number;
}
