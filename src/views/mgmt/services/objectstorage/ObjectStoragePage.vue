<template>
    <v-breadcrumbs class="pa-0" :items="['서비스 관리', 'ObjectStorage', providerId ?? 'n/a']" density="compact"></v-breadcrumbs>
    <PageToolbar title="Buckets" :label="providerId" :previous="true" :previous-to="{ name: 'ObjectStorgaeProviders' }" :closeable="false" :divider="false" :items="[
        { icon: 'mdi-refresh', event: 'refresh', }]"></PageToolbar>
    <GridContent ref="gridContentRef" :rowData="gridData" :rowSelection="'none'" :height=300 :columns="columnDefs">
    </GridContent>
    <v-card density="compact" class="mt-5">
        <v-list-item class="pa-2 ma-0">
            <template v-slot:title>
                <v-breadcrumbs :items="crumbs" class="pt-2 pb-0" density="compact" v-if="is_visible_breadcrumb">
                    <template v-slot:prepend>
                        <v-icon icon="mdi-bucket" size="small" color="blue"></v-icon>
                    </template>
                    <template v-slot:divider>
                        <v-icon icon="mdi-chevron-right" size="small"></v-icon>
                    </template>
                    <template #item="{ item }">
                        <v-breadcrumbs-item @click="onCrumbClick(item)" :disabled="item.disabled">
                            {{ item.label }}
                        </v-breadcrumbs-item>
                        <v-chip v-if="item.disabled && lastRow > 0 " color="red" density="comfortable" variant="text">({{ lastRow-1 }})</v-chip>
                    </template> 
                </v-breadcrumbs>
            </template>
            <template v-slot:append> 
                <v-btn variant="tonal" color="primary" :disabled="!has_more" @click="onLoadMore" rounded="xl" :loading="loaderForObjects">
                    <v-icon start>mdi-download-multiple</v-icon> 더 불러오기
                </v-btn>
            </template>
        </v-list-item>
        <v-divider></v-divider> 
        <v-col cols="12" md="12">
            <GridContent ref="gridContentRef_Objects" :rowData="gridDataForObjects" :rowSelection="'none'" :columns="columnDef_Objects">
            </GridContent>
        </v-col>
    </v-card>
    <ObjectDialog v-model="obejctHeadDialog.visible" :bucket="bucket" :object-key="obejctHeadDialog.key" @close="obejctHeadDialog.visible = false"></ObjectDialog>  
</template>
<script setup lang="ts">
import type { BucketDto, ObjectListItemDto } from '@/types/studio/storage';
import { createObjectStorageStore } from '@/stores/studio/objectstorage.store.factory';
import { computed, onMounted, ref } from 'vue';
import PageToolbar from '@/components/buttons/PageToolbar.vue';
import GridContent from '@/components/ag-grid/GridContent.vue';
import type { ColDef } from 'ag-grid-community';
import { formatDataSize, resolveAxiosError } from '@/utils/helpers';
import { buildBreadcrumb, type BreadcrumbItem } from '@/data/studio/storage';
import ObjectDialog from './ObjectDialog.vue';
import { useToast } from '@/plugins/toast';

const toast = useToast();

const props = defineProps({
    providerId: { type: String, default: null },
});

const useObjectStoreStore = createObjectStorageStore(props.providerId, 200);
const objectstorage = useObjectStoreStore(); 

// common Grid.
const bucket = ref<BucketDto | null>(null);
const prefix = ref<string>("");
// Object  Grid
const gridDataForObjects = ref<ObjectListItemDto[]>();
const loaderForObjects = ref(false);
const columnDef_Objects: ColDef[] = [
    {
        field: 'key', headerName: '이름', filter: false, sortable: true, type: "hyperlinks", flex: 1, cellRendererParams: {
            mode: 'callback',
            icon: (row: ObjectListItemDto) => row.folder ? "mdi mdi-folder-outline" : "mdi mdi-file-outline",
            text: (row: ObjectListItemDto) => displayObjectName(row),
            labelClassName: "ag-link__label hover:underline",
            //disabled: (row: ObjectListItemDto) => !row.folder,
            onClick: async (row: ObjectListItemDto) => {
                const b = bucket.value?.bucket??'';
                if (row.folder) {
                    prefix.value = row.key;
                    objectstorage.setPage(0);
                    objectstorage.setContext({ bucket: b, prefix: prefix.value });
                    refresh_data_objects();
                }else{ 
                    obejctHeadDialog.value.key = row.key;
                    obejctHeadDialog.value.visible = true;
                }
            },
        }
    },
    { field: 'key', headerName: 'key', filter: true, sortable: true, type: "string", flex: 1 },
    { field: 'size', headerName: '크기', filter: false, sortable: true, type: "number", flex: .5, valueFormatter: formatDataSize },
    { field: 'lastModified', headerName: '수정일', filter: false, sortable: true, type: "datetime", flex: .5 },
];
const gridContentRef_Objects = ref<InstanceType<typeof GridContent> | null>(null);

const refresh_data_objects = () => {
    get_data_objects(true, false);
}
const clear_filters = () => {
    gridContentRef_Objects.value?.clearFilters();
}

async function get_data_objects(force: boolean = false, append: boolean = false) {
  loaderForObjects.value = true;
  gridContentRef_Objects.value?.loading(true);
  try {
    // append=true 이면 언제든 가져오고, 아니면 기존이 비었거나 force일 때만
    if (append || force || (gridDataForObjects.value?.length ?? 0) === 0) {
      const data = await objectstorage.getObjects(); // 필요시 page/size 옵션 전달
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      // prefix 플레이스홀더 제거 ('dir' / 'dir/')
      const p = (prefix.value ?? "").trim();
      let filtered = rows;
      if (p.length > 0) {
        const slash = p.endsWith("/") ? p : `${p}/`;
        const noSlash = p.endsWith("/") ? p.slice(0, -1) : p;
        filtered = rows.filter((item: any) => {
          const key = item?.key ?? "";
          return key !== slash && key !== noSlash;
        });
      }
      if (append) {
        // 뒤에 추가 + key 기준 중복 제거
        const merged = [...(gridDataForObjects.value ?? []), ...filtered];
        const seen = new Set<string>();
        gridDataForObjects.value = merged.filter((it: any) => {
          const k = String(it?.key ?? "");
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        // lastRow 갱신: 더 있음(-1)이면 유지, 아니면 현재 길이로 보정
        if (data.lastRow === -1) {
          lastRow.value = -1;
        } else if (lastRow.value !== -1) {
          lastRow.value = gridDataForObjects.value.length;
        } // lastRow가 -1이면 그대로 유지
      } else {
        // 교체 모드
        gridDataForObjects.value = [...filtered];
        lastRow.value = data.lastRow; // 서버 관례 사용(-1: 더 있음)
      }
    }
  } finally {
    loaderForObjects.value = false;
    gridContentRef_Objects.value?.loading(false);
  }
}

const lastRow = ref<number>(0);
const has_more = computed(() => lastRow.value == -1);
const is_visible_breadcrumb = computed(() => bucket.value != null);
const crumbs = computed(() => buildBreadcrumb(prefix.value, { rootLabel: bucket.value?.bucket }));
const page = computed(() => objectstorage.getPage());

const obejctHeadDialog = ref({
    visible: false,  
    key: '',
});

const onCrumbClick = (row: BreadcrumbItem) => {
    if (!row.disabled && bucket.value && prefix.value !== row.prefix) {
        prefix.value = row.prefix;
        objectstorage.setPage(0);
        objectstorage.setContext({ bucket: bucket.value?.bucket, prefix: prefix.value });
        refresh_data_objects();
    }
}

const onLoadMore = async () => { 
    const last = gridDataForObjects.value?.length ?? 0 ; 
    objectstorage.setPage(page.value + 1);  
    await get_data_objects(true, true);   
    gridContentRef_Objects.value?.reserveScrollTo(last);
};

const displayObjectName = (item: ObjectListItemDto) => {
    if (prefix.value.length > 0)
        return item.key.replace(prefix.value, "");
    else
        return item.key;
}
// Bucket Grid
const gridData = ref<BucketDto[]>();
const loader = ref(false); 
const columnDefs: ColDef[] = [
    {
        field: 'bucket', headerName: '버킷', filter: false, sortable: true, type: "hyperlinks", flex: 1, cellRendererParams: {
            mode: 'callback',
            icon: "mdi mdi-bucket-outline",
            onClick: async (row: BucketDto) => {
                bucket.value = row;
                prefix.value = "";
                objectstorage.setContext({ bucket: bucket.value.bucket, prefix: prefix.value });
                clear_filters();
                refresh_data_objects();
            },
        }
    },
    { field: 'objectStorageType', headerName: '유형', filter: false, sortable: true, type: "string", flex: .5 },
    { field: 'createdDate', headerName: '생성일', filter: false, sortable: true, type: "datetime", flex: .5 },
];

const gridContentRef = ref<InstanceType<typeof GridContent> | null>(null);
const refresh = () => {
    getData(true);
    bucket.value = null;
    prefix.value = "";
}

async function getData(force: boolean = false) { 
    loader.value = true;
    gridContentRef.value?.loading(true);
    if( props.providerId != objectstorage.getProviderId() )
        objectstorage.setProviderId(props.providerId);
    if (force || gridData.value?.length == 0) {
        try{
        const data = await objectstorage.getBuckets();
        gridData.value = [...data];
        gridDataForObjects.value = [];
        }catch(e:any){
            toast.error(resolveAxiosError(e));
            console.log(e);
            gridData.value = [];
            gridDataForObjects.value = [];
        }finally{
            loader.value = false;
            gridContentRef.value?.loading(false);
        }
    }
}

onMounted(() => {
    getData(true);
});

</script>