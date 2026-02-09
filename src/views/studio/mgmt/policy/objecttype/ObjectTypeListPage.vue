<template>
  <v-breadcrumbs class="pa-0" :items="['응용프로그램', '자원', '객체 유형']" density="compact" />
  <PageToolbar
    title="객체 유형"
    label="객체 유형을 관리합니다."
    @create="goCreate"
    @refresh="refresh"
    @reload="reloadTypes"
    :closeable="false"
    :divider="true"
    :items="[
      { icon: 'mdi-file-plus', event: 'create', color: 'blue', tooltip: '새 객체 유형' },
      { icon: 'mdi-refresh', event: 'refresh', tooltip: '새로고침' },
      { icon: 'mdi-reload', event: 'reload', color: 'purple', tooltip: '리로드' },
    ]"
  />
  <v-card density="compact" class="mt-1" variant="text">
    <v-card-actions class="pa-0">
      <v-container fluid class="pa-0">
        <v-row>
          <v-col cols="3">
            <v-text-field
              v-model="domain"
              label="도메인"
              hide-details
              variant="outlined"
              density="compact"
            />
          </v-col>
          <v-col cols="3">
            <v-select
              v-model="status"
              :items="statusOptions"
              label="상태"
              hide-details
              variant="outlined"
              density="compact"
              clearable
            />
          </v-col>
          <v-col>
            <v-text-field
              v-model="q"
              label="검색어"
              placeholder="코드 또는 이름"
              @keydown.enter="onSearchClick"
              hide-details
              variant="outlined"
              density="compact"
            >
              <template v-slot:append>
                <v-btn icon="mdi-text-search" variant="tonal" @click="onSearchClick" />
              </template>
            </v-text-field>
          </v-col>
        </v-row>
      </v-container>
    </v-card-actions>
  </v-card>
  <PageableGridContent
    ref="pageableGridContentRef"
    :datasource="dataStore"
    :columns="columnDefs"
    :options="gridOptions"
  />
</template>

<script setup lang="ts">
import PageableGridContent from "@/components/ag-grid/PageableGridContent.vue";
import RemoteMgmtUserCellRenderer from "@/components/ag-grid/renderer/RemoteMgmtUserCellRenderer.vue";
import PageToolbar from "@/components/bars/PageToolbar.vue";
import { objectTypeAdminApi } from "@/data/studio/mgmt/objecttype";
import { useToast } from "@/plugins/toast";
import { useObjectTypeListStore } from "@/stores/studio/mgmt/objecttype.store";
import type { ColDef, GridOptions } from "ag-grid-community";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";

const toast = useToast();
const router = useRouter();
const dataStore = useObjectTypeListStore();

const statusOptions = [
  { title: "활성", value: "ACTIVE" },
  { title: "Deprecated", value: "DEPRECATED" },
  { title: "비활성", value: "DISABLED" },
];

const statusLabel = (value?: string | null) => {
  if (!value) return "";
  const v = value.toUpperCase();
  if (v === "ACTIVE") return "활성";
  if (v === "DEPRECATED") return "Deprecated";
  if (v === "DISABLED") return "비활성";
  return value;
};

const columnDefs: ColDef[] = [
  { field: "objectType", headerName: "ID", type: "number", maxWidth: 90 , filter: false},
  {
    field: "code",
    filter: false,
    headerName: "코드",
    flex: 1,
    type: "hyperlinks",
    cellRendererParams: {
      mode: "router",
      to: (d: any) => ({ name: "ObjectTypeDetails", params: { objectType: d.objectType } }),
      router: router,
    },
  },
  { field: "name", headerName: "이름", flex: 1,filter: false },
  { field: "domain", headerName: "도메인", flex: 1,filter: false },
  {
    field: "status",
    headerName: "상태",
    flex: 1,
    valueFormatter: (params) => statusLabel(params.value), filter: false,
  },
  {
    field: "createdById",
    headerName: "생성자",
    flex: 1,
    cellRenderer: RemoteMgmtUserCellRenderer, filter: false,
  },
  { field: "createdAt", headerName: "생성일시", type: "datetime", flex: 1 ,filter: false,},
  {
    field: "updatedById",
    headerName: "수정자",
    flex: 1,
    cellRenderer: RemoteMgmtUserCellRenderer,filter: false,
  },
  { field: "updatedAt", headerName: "수정일시", type: "datetime", flex: 1 ,filter: false,},
];

const gridOptions: GridOptions = {
  rowSelection: { mode: 'singleRow', enableClickSelection: true },
  rowMultiSelectWithClick: false,
};

const pageableGridContentRef = ref<InstanceType<typeof PageableGridContent> | null>(null);

const domain = ref<string | null>(null);
const status = ref<string | null>(null);
const q = ref<string | null>(null);

const goCreate = () => {
  router.push({ name: "ObjectTypeCreate" });
};

const refresh = () => {
  pageableGridContentRef.value?.refresh();
};

const reloadTypes = async () => {
  try {
    await objectTypeAdminApi.reload();
    toast.success("리로드가 완료되었습니다.");
    refresh();
  } catch {
    toast.error("리로드에 실패했습니다.");
  }
};

const onSearchClick = () => {
  const params: Record<string, any> = {};
  if (domain.value?.trim()) params.domain = domain.value.trim();
  if (status.value?.trim()) params.status = status.value.trim();
  if (q.value?.trim()) params.q = q.value.trim();
  dataStore.setFilter(params);
  refresh();
};

onMounted(() => {
  refresh();
});
</script>
