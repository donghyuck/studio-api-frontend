<template>
    <v-dialog v-model="dialogOpen" width="650" :fullscreen="false" :scrim="true" transition="dialog-bottom-transition">
        <v-card>
            <PageToolbar :title="attachment?.name" @close="handleClose" :closeable="true" :divider="true"
                @refresh="getData(true)" :items="[{ icon: 'mdi-refresh', event: 'refresh' }]" />
            <v-card-text>
                <v-row>
                    <v-col>
                        <v-number-input v-model="attachment.objectType" :reverse="false" controlVariant="default"
                            label="객체 유형" :hideInput="false" :min="0" :inset="false" hide-details></v-number-input>
                    </v-col>
                    <v-col>
                        <v-number-input v-model="attachment.objectId" :reverse="false" controlVariant="default"
                            label="객체 식별자" :hideInput="false" :min="0" :inset="false" hide-details></v-number-input>
                    </v-col>
                    <v-col>
                        <v-text-field label="Content Type" v-model="attachment.contentType" hide-details disabled
                            type="text"></v-text-field></v-col>
                </v-row>
                <v-row dense>
                    <v-col cols="12" sm="12">
                        <v-textarea :model-value="extracted_text" hide-details :loading="text_extracting" size="small"
                            readonly variant="filled" label="Text" type="text">
                            <template v-slot:append-inner>
                                <v-icon v-if="text_extracted" icon="mdi-content-copy"
                                    @click="copy_extracted_text"></v-icon>
                            </template>
                            <template v-slot:append>
                                <v-tooltip text="콘텐츠에서 텍스트를 추출합니다." location="start">
                                    <template v-slot:activator="{ props }">
                                        <v-icon v-if="!text_extracted" :disabled="text_extracting"
                                            icon="mdi-text-recognition" color="red" v-bind="props"
                                            @click="extract_text_from_content"></v-icon>
                                    </template>
                                </v-tooltip>
                            </template>
                        </v-textarea>
                    </v-col>
                </v-row>
            </v-card-text>
            <v-card-text class="pt-0">
                <v-table density="compact" striped="even" v-if="rag_indexed" class="border-opacity-100">
                    <thead>
                        <tr>
                            <th class="text-left">
                                Name
                            </th>
                            <th class="text-left">
                                Value
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(value, key) in rag_metadata" :key="key">
                            <td>{{ key }}</td>
                            <td>{{ value }}</td>
                        </tr>
                    </tbody>
                </v-table>
            </v-card-text>
            <v-divider />
            <v-card-actions>
                <v-btn variant="outlined" prepend-icon="mdi-vector-polyline-plus" rounded="xl" color="red" width="120"
                    :disabled="rag_indexed" @click="rag_index" :loading="rag_idnexing">
                    RAG 인덱싱
                </v-btn>
                <v-spacer />
                <v-btn variant="tonal" color="grey" rounded="xl" @click="handleClose" width="100">
                    Cancel
                </v-btn>
            </v-card-actions>
        </v-card>
        <v-overlay v-model="overlay" contained class="align-center justify-center">
            <v-progress-circular color="primary" indeterminate size="64" />
        </v-overlay>
    </v-dialog>
</template>
<script setup lang="ts">
import PageToolbar from '@/components/bars/PageToolbar.vue';
import { extractText, hasEmbedding, ragIndex, ragMetadata } from '@/data/studio/mgmt/files';
import { useConfirm } from '@/plugins/confirm';
import { useToast } from '@/plugins/toast';
import { usePageableFilesStore } from '@/stores/studio/mgmt/files.store';
import { type AttachmentDto, emptyAttachment } from '@/types/studio/files';
import { resolveAxiosError } from '@/utils/helpers';
import { computed, onBeforeUnmount, ref, watch } from 'vue';

const store = usePageableFilesStore();
const confirm = useConfirm();
const toast = useToast()
const overlay = ref<boolean>(false);
const props = defineProps<{
    modelValue: boolean,
    attachmentId?: number,
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', v: boolean): void
    (e: 'close'): void
    (e: 'updated', payload: any): void
}>()

/** 닫기: 여기서만 초기화 */
function handleClose() {
    emit('close')
}

const dialogOpen = computed({
    get: () => props.modelValue,
    set: (v: boolean) => emit('update:modelValue', v),
})

const objectType = ref<number | null>(0)
const objectId = ref<number | null>(0)
const attachment = ref<AttachmentDto>(
    emptyAttachment()
);
onBeforeUnmount(() => {

})

watch(dialogOpen, async (open) => {
    if (!open) return;
    const id = props.attachmentId;
    if (id && id > 0) {
        if (!attachment.value || attachment.value.attachmentId !== id) {
            await getData(true);
        }
    }
});


const rag_metadata = ref<Record<string, unknown>>();
async function getData(force: boolean = false) {
    if (!props.attachmentId) return;

    overlay.value = true;
    try {
        const data = await store.byId(props.attachmentId)
        attachment.value = data as AttachmentDto;
        const check = await hasEmbedding(props.attachmentId);
        rag_indexed.value = check as boolean;
        text_extracting.value = false;
        text_extracted.value = false;
        extracted_text.value = '';
        if (check) {
            const metadata = await ragMetadata(props.attachmentId);
            rag_metadata.value = metadata;
        }
    } catch (e) {
        toast.error(resolveAxiosError(e));
        rag_indexed.value = false;
    } finally {
        overlay.value = false;
    }
}

const text_extracting = ref<boolean>(false);
const text_extracted = ref<boolean>(false);
const extracted_text = ref<string>('');
async function extract_text_from_content() {
    if (!props.attachmentId) return;

    const ok = await confirm({
        title: '확인',
        message: `${attachment.value.name} 에서 텍스트를 추출하시겠습니까?`,
        okText: '예',
        cancelText: '아니오',
        color: 'primary',
    });
    if (!ok) return;

    try {
        text_extracting.value = true;
        const data = await extractText(props.attachmentId);
        extracted_text.value = data;
        text_extracted.value = true;
    } catch (e: any) {
        toast.error(resolveAxiosError(e));
    } finally {
        text_extracting.value = false;
    }
}

const rag_indexed = ref<boolean>(false);
const rag_idnexing = ref<boolean>(false);
async function rag_index() {
    if (!props.attachmentId) return;
    if (rag_indexed.value) return;
    try {
        rag_idnexing.value = true;
        await ragIndex(props.attachmentId, { useLlmKeywordExtraction: true });
        rag_indexed.value = true;
        toast.success(`${attachment.value.name} 파일은 문장(조각)으로 나눠 벡터 저장소에 저장되었습니다.`)
    } catch (e) {
        toast.error(resolveAxiosError(e));
    } finally {
        rag_idnexing.value = false;
    }
}
async function copy_extracted_text() {
    const text = extracted_text.value?.toString() ?? "";

    // 1) 복사할 텍스트가 없으면 바로 종료
    if (!text.trim()) {
        toast.warning("복사할 텍스트가 없습니다.");
        return;
    }

    // 2) Clipboard API 지원 여부 확인
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
        toast.error("현재 브라우저에서는 클립보드 복사를 지원하지 않습니다.");
        return;
    }

    // 3) 실제 복사 시도
    try {
        await navigator.clipboard.writeText(text);
        toast.success("클립보드에 복사했습니다.");
    } catch (e) {
        console.error(e);
        toast.error("클립보드에 복사할 수 없습니다. 브라우저 권한을 확인해 주세요.");
    }
}
</script>