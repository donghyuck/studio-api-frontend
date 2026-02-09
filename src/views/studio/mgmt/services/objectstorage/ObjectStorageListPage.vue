<template>
    <v-breadcrumbs class="pa-0" :items="['서비스 관리', 'ObjectStorage', '서비스 제공자']" density="compact"></v-breadcrumbs>
    <PageToolbar title="Providers" @refresh="refresh" :closeable="false" :divider="false" :items="[
        { icon: 'mdi-refresh', event: 'refresh', variant: 'text' }]"></PageToolbar>
    <v-row>
        <v-col cols="12" md="12">
            <GridContent ref="gridContentRef" :rowData="gridData" style="" :auto-resize="false" :columns="columnDefs"
                :options="gridOptions">
            </GridContent>
        </v-col>
    </v-row>
</template>
<script setup lang="ts">
import PageToolbar from '@/components/bars/PageToolbar.vue';
import GridContent from '@/components/ag-grid/GridContent.vue';
import { onMounted, ref } from 'vue';
import type { ColDef } from 'ag-grid-community';
import type { ProviderDto } from '@/types/studio/storage';
import { fetchProviders } from '@/data/studio/mgmt/storage';
import router from '@/router';
import { resolveAxiosError } from '@/utils/helpers';
import { useToast } from '@/plugins/toast';
import type { GridOptions } from 'ag-grid-community';
const toast = useToast();
const gridData = ref<ProviderDto[]>([]);
const loader = ref(false);
// define grid columns
const columnDefs: ColDef[] = [
    {
        field: 'name', headerName: 'ID', filter: false, sortable: true, type: "hyperlinks", flex: 1, cellRendererParams: {
            mode: 'router',
            to: (d: any) => ({ name: 'ObjectStorage', params: { providerId: d.name } }),
            router: router,
        }
    },
    { field: 'type', headerName: '유형', filter: false, sortable: true, type: "string", flex: .5 },
    { field: 'status', headerName: '상태', filter: false, sortable: true, type: "string", flex: .5 },
    { field: 'region', headerName: '리즌', filter: false, sortable: true, type: 'text', flex: .5 },
    { field: 'endpointMasked', headerName: '엔드포인트', filter: false, sortable: false, type: 'text', flex: 2 },
];

const gridOptions: GridOptions = {
    onRowClicked: (event: any) => {
        const row = event?.data as ProviderDto | undefined;
        const providerId = row?.name;
        if (!providerId) return;
        router.push({ name: 'ObjectStorage', params: { providerId } });
    },
};

const gridContentRef = ref<InstanceType<typeof GridContent> | null>(null);

const refresh = () => {
    getData(true);
}

async function getData(force: boolean = false) {
    loader.value = true;
    if (force || gridData.value?.length === 0) {
        gridContentRef.value?.loading(true);
        try {
            const data = await fetchProviders();
            gridData.value = [...data];
        } catch (e: any) {
            toast.error(resolveAxiosError(e));
        } finally {
            gridContentRef.value?.loading(false);
        }
    }
    loader.value = false;
}

onMounted(() => {
    getData(true);
});

</script>
