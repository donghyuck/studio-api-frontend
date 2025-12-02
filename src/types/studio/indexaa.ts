import type { SortModelItem } from 'ag-grid-community';
import type { Ref } from 'vue';

// `Signup` 타입 정의
type Signup = {
  name: string | null;
  username: string | null;
  password: string | null;
  email: string | null;
  confirmPassword: string | null;
  nameVisible: boolean | false;
  emailVisible: boolean | false;
};

type Datasource = {
  isLoaded: Ref<boolean>;
  dataItems: Ref<any[]>;
  total: Ref<number>;
  pageSize: Ref<number>;
  setSort(newValue: SortModelItem[]): void;
  setFilter(newValue: any): void;
  setPage(newVal: number): void;
  fetch(): Promise<void>;
};

type PageableDataSource = {
  isLoaded: Ref<boolean>;
  dataItems: Ref<any[]>;
  total: Ref<number>;
  pageSize: Ref<number>;
  setSort(newValue: SortModelItem[]): void;
  setFilter(newValue: any): void;
  setPage(newVal: number): void;
  fetch(): Promise<void>;
};

type EnableActions = {
  enable(): Promise<void>;
  disable(): Promise<void>;
  isEnabled(): Promise<boolean>;
};

export type { Datasource, EnableActions, PageableDataSource, Signup };

