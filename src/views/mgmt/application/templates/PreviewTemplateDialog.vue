<template>
    <v-dialog v-model="dialog" fullscreen hide-overlay transition="dialog-bottom-transition" scrollable>
        <template v-slot:activator="{ props }">
            <v-btn v-bind="props" text="Test Run" :disabled="templateId <= 0" prepend-icon="mdi-run" color="blue"
                rounded="xl" width="120">
            </v-btn>
        </template>
        <v-card tile>
            <v-toolbar flat dark color="primary">
                <v-toolbar-title>Test Run</v-toolbar-title>
                <v-spacer></v-spacer>
                <v-toolbar-items>
                </v-toolbar-items>
                <v-btn variant="tonal" class="mr-2" :loading="running" :disabled="templateId <= 0" 
                    prepend-icon="mdi-run" @click="runTest">
                    Run Preview
                </v-btn>
                <v-btn icon dark @click="dialog = false">
                    <v-icon>mdi-close</v-icon>
                </v-btn>
            </v-toolbar>
            <v-card-text> 
                <v-skeleton-loader :loading="loading" type="article">
                    <PropertiesGrid title="테스트 변수" subtitle="테븚릿 테스트를 위해서 필요한 변수 값을 입력해주세요."
                        :rowData="properties" @change="handlePropertyChange" height="300px" />
                    <v-divider class="my-4" />
                    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">
                        {{ errorMessage }}
                    </v-alert>
                    <v-alert v-else-if="requiredVarsText" type="info" variant="tonal" class="mb-4">
                        필요 변수: {{ requiredVarsText }}
                    </v-alert>
                    <div class="render-status">
                        <v-chip size="small" variant="tonal" :color="subjectRenderStatusColor">
                            Subject: {{ subjectRenderStatusText }}
                        </v-chip>
                        <v-chip size="small" variant="tonal" :color="bodyRenderStatusColor">
                            Body: {{ bodyRenderStatusText }}
                        </v-chip>
                    </div>
                    <v-text-field label="Rendered Subject" v-model="previewSubject" readonly density="compact" />
                    <div class="preview-frame">
                        <iframe :srcdoc="previewBody" title="Rendered Preview" sandbox="allow-same-origin"></iframe>
                    </div>
                </v-skeleton-loader>
            </v-card-text> 
        </v-card>
    </v-dialog>
</template>
<script setup lang="ts">
import { renderBody, renderSubject } from '@/data/studio/template';
import { usePageableTemplateStore } from '@/stores/studio/template.store';
import type { Property } from '@/types/studio';
import { computed, ref, watch } from 'vue';
import PropertiesGrid from '../../PropertiesGrid.vue';
import { fromRowData, resolveAxiosError, toRowData } from '@/utils/helpers';

const dialog = ref(false)
const loading = ref(false);
const running = ref(false);
const errorMessage = ref('');

const props = defineProps({
    templateId: { type: Number, default: 0 },
});

const dataStore = usePageableTemplateStore();

const properties = ref<Property[]>([]);
const previewSubject = ref('');
const previewBody = ref('');
const templateBody = ref('');
const templateSubject = ref('');
const subjectRenderStatus = ref<'idle' | 'skipped' | 'rendered' | 'error'>('idle');
const bodyRenderStatus = ref<'idle' | 'skipped' | 'rendered' | 'error'>('idle');

function handlePropertyChange(all: Property[]) { 
    properties.value = all;
}

function buildRenderModel() {
    const rows = properties.value
        .map((row) => ({
            name: (row.name ?? '').toString().trim(),
            value: row.value,
        }))
        .filter((row) => row.name.length > 0);
    return fromRowData(rows as Property[]);
}

function ensurePropertyVars(varNames: string[]) {
    if (varNames.length === 0) return;
    const existing = new Set(
        properties.value
            .map((row) => (row.name ?? '').toString().trim())
            .filter((name) => name.length > 0)
    );
    const missing = varNames.filter((name) => !existing.has(name));
    if (missing.length === 0) return;
    properties.value = [
        ...properties.value,
        ...missing.map((name) => ({ name, value: '' })),
    ];
}

async function runTest() {
    if (props.templateId <= 0) return;
    running.value = true;
    errorMessage.value = '';
    try {
        const model = buildRenderModel();
        const hasSubject = (templateSubject.value ?? '').trim().length > 0;
        const hasBody = (templateBody.value ?? '').trim().length > 0;
        const requests: Promise<{ kind: 'subject' | 'body'; data: any }>[] = [];
        if (hasSubject) {
            requests.push(
                renderSubject(props.templateId, model).then((res) => ({ kind: 'subject', data: res }))
            );
            subjectRenderStatus.value = 'idle';
        } else {
            previewSubject.value = '';
            subjectRenderStatus.value = 'skipped';
        }
        if (hasBody) {
            requests.push(
                renderBody(props.templateId, model).then((res) => ({ kind: 'body', data: res }))
            );
            bodyRenderStatus.value = 'idle';
        } else {
            previewBody.value = '';
            bodyRenderStatus.value = 'skipped';
        }
        const results = await Promise.all(requests);
        for (const result of results) {
            if (result.data?.success === false) {
                errorMessage.value = '렌더링에 실패했습니다.';
                if (result.kind === 'subject') previewSubject.value = '';
                if (result.kind === 'body') previewBody.value = '';
                if (result.kind === 'subject') subjectRenderStatus.value = 'error';
                if (result.kind === 'body') bodyRenderStatus.value = 'error';
                continue;
            }
            if (result.kind === 'subject') previewSubject.value = result.data?.data ?? '';
            if (result.kind === 'body') previewBody.value = result.data?.data ?? '';
            if (result.kind === 'subject') subjectRenderStatus.value = 'rendered';
            if (result.kind === 'body') bodyRenderStatus.value = 'rendered';
        }
    } catch (e) {
        errorMessage.value = resolveAxiosError(e);
        subjectRenderStatus.value = 'error';
        bodyRenderStatus.value = 'error';
    } finally {
        running.value = false;
    }
}

async function getData() {
    loading.value = true;
    errorMessage.value = '';
    try {
        const data = await dataStore.byId(props.templateId) 
        if (data) {
            properties.value = toRowData( data.properties ?? [] );
            previewSubject.value = '';
            previewBody.value = '';
            templateBody.value = data.body ?? '';
            templateSubject.value = data.subject ?? '';
            ensurePropertyVars(extractFreemarkerVariables(templateBody.value));
            subjectRenderStatus.value = (templateSubject.value ?? '').trim().length > 0 ? 'idle' : 'skipped';
            bodyRenderStatus.value = (templateBody.value ?? '').trim().length > 0 ? 'idle' : 'skipped';
        }
    } catch (e) {
        errorMessage.value = resolveAxiosError(e);
    } finally {
        loading.value = false;
    }
}

watch([() => props.templateId, dialog], ([id, open], [prevId, prevOpen]) => {
    if (!open || id <= 0) return;
    if (id !== prevId || !prevOpen) {
        getData();
    }
}, { immediate: true });

function extractFreemarkerVariables(template: string): string[] {
    if (!template) return [];
    const matches = template.match(/\$\{[^}]+\}/g) ?? [];
    const vars = new Set<string>();
    for (const match of matches) {
        const inner = match.slice(2, -1).trim();
        if (!inner) continue;
        const primary = inner.split(/[!?<>=:+\-*/|,()\s]/)[0];
        if (primary) vars.add(primary);
    }
    return [...vars];
}

const requiredVarsText = computed(() => {
    const vars = extractFreemarkerVariables(templateBody.value);
    return vars.join(', ');
});

const subjectRenderStatusText = computed(() => {
    if (subjectRenderStatus.value === 'rendered') return 'rendered';
    if (subjectRenderStatus.value === 'skipped') return 'skipped';
    if (subjectRenderStatus.value === 'error') return 'error';
    return 'pending';
});
const bodyRenderStatusText = computed(() => {
    if (bodyRenderStatus.value === 'rendered') return 'rendered';
    if (bodyRenderStatus.value === 'skipped') return 'skipped';
    if (bodyRenderStatus.value === 'error') return 'error';
    return 'pending';
});
const subjectRenderStatusColor = computed(() => {
    if (subjectRenderStatus.value === 'rendered') return 'success';
    if (subjectRenderStatus.value === 'skipped') return 'grey';
    if (subjectRenderStatus.value === 'error') return 'error';
    return 'primary';
});
const bodyRenderStatusColor = computed(() => {
    if (bodyRenderStatus.value === 'rendered') return 'success';
    if (bodyRenderStatus.value === 'skipped') return 'grey';
    if (bodyRenderStatus.value === 'error') return 'error';
    return 'primary';
});

watch(templateBody, (value) => {
    ensurePropertyVars(extractFreemarkerVariables(value));
});

</script>
<style scoped>
.preview-frame {
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 6px;
    overflow: hidden;
    min-height: 240px;
}
.preview-frame iframe {
    border: 0;
    width: 100%;
    height: 320px;
    display: block;
    background: #fff;
}
.render-status {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
    flex-wrap: wrap;
}
</style>
