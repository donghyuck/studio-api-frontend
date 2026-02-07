export type Id = number | string;

export type Nullable<T> = T | null;

export type IsoInstant = string;

export type IsoOffsetDateTime = string;

export type WithEtag<T> = { data: T; etag?: string };

export type Sort = string;

export interface PageParams {
  page?: number;
  size?: number;
  sort?: Sort | Sort[];
}

export interface Timestamped {
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface PageMeta {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface PageRequest {
  page?: number;
  size?: number;
  sort?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  numberOfElements?: number;
  first?: boolean;
  last?: boolean;
  sort?: unknown;
  empty?: boolean;
}

export interface Property {
  name: string;
  value: unknown;
}
