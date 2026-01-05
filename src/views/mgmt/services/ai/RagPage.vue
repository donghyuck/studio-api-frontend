<template>
    <v-breadcrumbs class="pa-0" :items="['서비스 관리', 'AI', 'RAG']" density="compact"></v-breadcrumbs>
    <PageToolbar title="검색" label="문서 벡터를 검색합니다." @refresh="refresh" :closeable="false" :divider="true" :prepend-items="[
    ]" :items="[
        { icon: 'mdi-refresh', event: 'refresh', }]"></PageToolbar>
    <v-card density="compact" class="mt-5">
        <v-alert closable rounded="0" icon="mdi-tooltip"
            :text="`질문을 벡터로 변환해 전체 문서 벡터와 비교하고, 그중 가장 비슷한 상위 ${searchForm.topK}개(Top-${searchForm.topK})를 찾아 결과를 보여줍니다.`"
            type="info" max-height="100"></v-alert>
        <v-card-text class="pb-0">
            <v-container fluid class="pa-0">
                <v-row>
                    <v-col cols="2">
                        <v-number-input v-model="searchForm.topK" :reverse="false" controlVariant="default" label="topK" density="compact"
                            hide-details :hideInput="false" :min="0" :inset="false"></v-number-input>
                    </v-col>
                    <v-col>
                        <v-text-field v-model="searchForm.query" label="쿼리" placeholder="쿼리(질문)을 입력하세요." row-height="15" density="compact"
                            rows="2" hide-details>
                            <template v-slot:append>
                                <v-btn icon="mdi-text-search" variant="tonal" @click="searchSemantic(false)"></v-btn>
                            </template>
                        </v-text-field>
                    </v-col>
                </v-row>
                <v-row>
                    <v-col>
                        <v-checkbox v-model="useQueryRewrite" :label="queryRewriteLabel"
                            hint="입력한 검색어를 AI가 관련 키워드로 확장해 더 다양한 결과를 찾습니다."></v-checkbox>
                    </v-col>
                </v-row>
            </v-container>
        </v-card-text>
        <v-expand-transition v-show="useQueryRewrite">
            <v-container fluid>
                <v-row>
                    <v-col>
                        <v-select prepend-icon="mdi-robot-outline" v-model="provider" :items="providerNames"
                            hide-details label="Provider" placeholder="provider (옵션)" variant="underlined" density="compact"
                            @update:model-value="onProviderChange" />
                    </v-col>
                    <v-col>
                        <v-text-field v-model="model" color="primary" label="LLM Model" placeholder="model (옵션)" density="compact"
                            hide-details variant="underlined"></v-text-field>
                    </v-col>
                    <v-col>
                        <v-btn :disabled="!enabledQueryRewrite" variant="outlined"
                            prepend-icon="mdi-file-replace-outline" rounded="xl" color="red" hide-details width="120" 
                            @click="queryRewrite" :loading="queryRewriting">
                            쿼리 확장
                        </v-btn>
                    </v-col>
                </v-row>
                <v-row v-if="expandedKeywords.length>0">
                    <v-col>
                        <v-chip-group selected-class="text-primary" column>
                            <v-chip v-for="tag in expandedKeywords" :key="tag">
                                {{ tag }}
                            </v-chip>
                        </v-chip-group>
                    </v-col>
                </v-row>
                <v-row>
                    <v-col>
                        <v-text-field v-model="expandedQuery" label="확장 쿼리" placeholder="화장쿼리는 자동 생생됩니다." density="compact"
                            row-height="15" max-rows="3" auto-grow readonly rows="2" hide-details>
                            <template v-slot:append>
                                <v-btn icon="mdi-text-search" variant="tonal" @click="searchSemantic(true)"></v-btn>
                            </template>
                        </v-text-field></v-col>
                </v-row>
            </v-container>
        </v-expand-transition>
    </v-card>
    <v-row>
        <v-col cols="12" md="12">
            <GridContent ref="gridContentRef" :rowData="gridData" style="" :options="{ rowHeight: 60 }"
                :auto-resize="false" :columns="columnDefs" class="mt-5">
            </GridContent>
        </v-col>
    </v-row>
</template>
<script setup lang="ts">
import GridContent from '@/components/ag-grid/GridContent.vue';
import PageToolbar from '@/components/buttons/PageToolbar.vue';
import { fetchProviders, rewriteQuery, searchVector } from '@/data/studio/ai';
import { useToast } from '@/plugins/toast';
import type { AiInfoResponse, ProviderInfo, QueryRewriteRequestDto, VectorSearchRequestDto, VectorSearchResultDto } from '@/types/studio/ai';
import { resolveAxiosError } from '@/utils/helpers';
import type { ColDef } from 'ag-grid-community';
import { computed, onMounted, reactive, ref } from 'vue';
import ContentCellRender from './ContentCellRender.vue';
import MetadataCellRender from './MetadataCellRender.vue';

const toast = useToast();

type SearchFormState = {
    query: string;
    embedding: string;
    topK: number | null;
};

const searchForm = reactive<SearchFormState>({
    query: '',
    embedding: '',
    topK: 3
});


const gridData = ref<VectorSearchResultDto[]>([]);
const loader = ref(false);
// define grid columns
const columnDefs: ColDef[] = [
    { field: 'documentId', headerName: 'ID', filter: false, sortable: true, type: "number", maxWidth: 100 },
    {
        field: 'score', headerName: '유사도', filter: false, sortable: true, type: "string", maxWidth: 100, valueFormatter: (params) => {
            if (!params.value) return "";
            return (params.value * 100).toFixed(2)
        },
    },
    { field: 'content', tooltipField: "content", headerName: '콘텐츠', filter: false, sortable: true, type: 'text', flex: 1, cellRenderer: ContentCellRender },
    {
        field: 'metadata', tooltipField: "content", headerName: '메타정보', filter: false, sortable: true, type: 'text', flex: 1,
        cellRenderer: MetadataCellRender
    },
];

const gridContentRef = ref<InstanceType<typeof GridContent> | null>(null);

async function searchSemantic(usingExpandedQuery: boolean = false) {
    loader.value = true;
    try {
        const payload = buildSearchPayload(searchForm);
        if( usingExpandedQuery )
            payload.query = expandedQuery.value;

        const data = await searchVector(payload);
        gridData.value = data;
    } catch (e: any) {
        toast.error(resolveAxiosError(e));
    } finally {
        gridContentRef.value?.loading(false);
        loader.value = false;
    }
}

const buildSearchPayload = (form: SearchFormState): VectorSearchRequestDto => {
    return {
        query: form.query || null,
        topK: Number(form.topK) || 3,
        hybrid: true,
    };
};

const refresh = () => {

}
const enabledQueryRewrite = computed(() => searchForm.query.length > 1 ? true : false);
const queryRewriting = ref<boolean>(false);
const useQueryRewrite = ref<boolean>(false);
const queryRewriteLabel = computed(() =>
    useQueryRewrite.value ? '검색어 자동 확장 : 활성화' : '검색어 자동 확장 : 비활성화'
);
const expandedQuery = ref<string>();
const expandedKeywords = ref<string[]>([]);
async function queryRewrite() {

    queryRewriting.value = true;
    try {
        const req: QueryRewriteRequestDto = {
            query: searchForm.query
        }
        const data = await rewriteQuery(req);
        expandedQuery.value = data.expandedQuery;
        expandedKeywords.value = data.keywords;
    } catch (e: any) {
        toast.error(resolveAxiosError(e));
    } finally {
        queryRewriting.value = false;
    }

}

/** query rewrite ...  */
const aiInfo = ref<AiInfoResponse | null>(null);
const providers = computed<ProviderInfo[]>(() => aiInfo.value?.providers ?? []);
const providerNames = computed<string[]>(
    () => aiInfo.value?.providers?.map(p => p.name) ?? []
);
const provider = ref("google-ai-gemini");
const model = ref("gemini-2.0-flash"); // 필요시 기본값 교체

function getChatModel(name?: string | null): string | null {
    return findProvider(name)?.chat?.model ?? null;
}
function isChatEnabled(name?: string | null): boolean {
    return !!findProvider(name)?.chat?.enabled;
}
function findProvider(name?: string | null): ProviderInfo | undefined {
    const key = (name ?? aiInfo.value?.defaultProvider ?? "").toLowerCase();
    return providers.value.find(p => p.name.toLowerCase() === key);
}

function setChatModel(name?: string | null): void {
    const chatEnable = isChatEnabled(name);
    const chatModel = getChatModel(name);
    if (chatModel)
        model.value = chatModel;
    else
        model.value = "";
}

const onProviderChange = (val: string | null) => {
    if (val)
        setChatModel(val);
}

async function getData(force: boolean = false) {

    try {
        const data = await fetchProviders(false);
        aiInfo.value = data;
        if (aiInfo.value)
            provider.value = aiInfo.value.defaultProvider;
        setChatModel(provider.value);
    } catch (e: any) {
        toast.error(resolveAxiosError(e));
    }

}

onMounted(() => {
    getData(false);
});


</script>
