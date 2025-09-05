import type { SortModelItem } from 'ag-grid-community';
import type { Ref } from 'vue'; 
 
type PageableDataSource = {
    isLoaded: Ref<boolean>;
    dataItems: Ref<any[]>;
    total: Ref<number>;
    pageSize: Ref<number>;
    setSort(newValue: SortModelItem[]): void;
    setFilter(newValue: any): void;
    setPage(newVal: number):void;
    fetch(): Promise<void>; 
}

export type { PageableDataSource };
