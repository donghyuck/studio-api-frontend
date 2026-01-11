<template>
    <v-dialog width="650" :fullscreen="false" :scrim="true" transition="dialog-bottom-transition">
        <v-card>
            <PageToolbar title="Object" :label="bucket.bucket" @refresh="getData(true)" @close="handleClose"
                :closeable="true" :divider="true" :items="[{ icon: 'mdi-refresh', event: 'refresh' }]" />
            <v-card-item>
                <v-table density="compact" striped="even" theme="dark">
                    <tbody>
                        <tr>
                            <td>이름</td>
                            <td>{{ head?.name }}</td>
                        </tr>
                        <tr>
                            <td>콘텐츠 종류</td>
                            <td>{{ head?.contentType }}</td>
                        </tr>
                        <tr>
                            <td>크기</td>
                            <td>{{ formatComma(head?.size) }} bytes</td>
                        </tr>
                        <tr>
                            <td>수정일</td>
                            <td>{{ formatDate(head?.modifiedDate) }}</td>
                        </tr>
                        <tr>
                            <td>etag</td>
                            <td>{{ head?.etag }}</td>
                        </tr>
                    </tbody>
                </v-table>
                <v-table density="compact" striped="even"
                    v-if="head?.metadata && Object.keys(head?.metadata).length > 0" class="border-opacity-100">
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
                        <tr v-for="(value, key) in head.metadata" :key="key">
                            <td>{{ key }}</td>
                            <td>{{ value }}</td>
                        </tr>
                    </tbody>
                </v-table>

            </v-card-item>
            <v-card-item class="mt-0 pt-0">
                <v-row>
                    <v-col cols="12">
                        <v-text-field :model-value="presign_get_url?.url" :loading="loading" size="xs"
                            :disabled="!is_head_loaded" readonly variant="filled" label="Pre Signed Access URL"
                            :hint="hint" type="text">
                            <template v-slot:append-inner>
                                <v-icon v-if="presign_get_url_generatored" icon="mdi-content-copy"
                                    @click="copy_presign_get_url"></v-icon>
                            </template>
                            <template v-slot:append>
                                <v-tooltip text="Generate Signed Access URL link." location="start"
                                    v-if="!presign_get_url_generatored">
                                    <template v-slot:activator="{ props }">
                                        <v-icon :disabled="loading" icon="mdi-shield-link-variant"
                                            @click="generate_presign_get_url" color="red" v-bind="props"></v-icon>
                                    </template>
                                </v-tooltip>
                            </template>
                        </v-text-field>
                    </v-col>
                </v-row>
            </v-card-item>
            <v-card-text class="mt-0 pt-0" v-if="is_image">
                <v-img width="50%" :src="presign_get_url?.url" class="bg-grey-lighten-2">
                    <template v-slot:placeholder>
                        <v-row align="center" class="fill-height ma-0" justify="center">
                            <v-progress-circular color="grey-lighten-5" indeterminate></v-progress-circular>
                        </v-row>
                    </template>
                </v-img>
            </v-card-text>
            <v-divider class="border-opacity-100" color="primary" />
            <v-card-actions>
                <v-btn variant="tonal" color="blue" prepend-icon="mdi-download-network" rounded="xl"
                    :disabled="!downloadable" @click="download_object"  width="130">
                    다운로드
                </v-btn>
                <v-btn variant="tonal" color="red" prepend-icon="mdi-file-eye-outline" rounded="xl"
                    :disabled="!previewable" @click="preview_object"  width="130">
                    미리보기
                </v-btn>
                <v-spacer />
                <v-btn variant="tonal" color="grey" rounded="xl" @click="handleClose" width="100">
                    닫기
                </v-btn>
            </v-card-actions>

        </v-card>
        <v-overlay v-model="overlay" contained class="align-center justify-center">
            <v-progress-circular color="primary" indeterminate size="64" />
        </v-overlay>
    </v-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import PageToolbar from '@/components/bars/PageToolbar.vue';
import type { BucketDto, ObjectInfoDto, PresignedUrlDto } from '@/types/studio/storage';
import { downloadFile, fetchObjectHead, openInNewTab, presignGet } from '@/data/studio/storage';
import dayjs from 'dayjs';
import { isVideoOrAudioOrImgOrPdf } from '@/utils/helpers';

interface Props {
    objectKey?: string
    bucket?: BucketDto
}
const props = withDefaults(defineProps<Props>(), {
    objectKey: undefined,
    bucket: undefined,
})
const head = ref<ObjectInfoDto>();

const downloadable = ref<boolean>(false);

const loading = ref(false);

const is_image = computed(() => is_head_loaded.value && head.value?.contentType?.startsWith("image/") && presign_get_url_generatored)

const is_head_loaded = computed(() => head.value?.key && head.value?.key == props.objectKey);

const presign_get_url = ref<PresignedUrlDto | undefined>();

const presign_get_url_generatored = computed(() => (presign_get_url.value?.url.trim()?.length ?? 0) > 0);

const hint = computed(() => {
    if (presign_get_url_generatored.value)
        return `생성된 URL 은 ${formatDate(presign_get_url.value?.expiresAt)} 까지 유효합니다.`
    else
        return "우측 아이콘을 클릭하면 다운로드를 위한 URL 을 생성할 수 있습니다."
})

const previewable = computed(()=>{
    if (!is_head_loaded.value) return false; 
    if (!head.value?.contentType) return false ;
    return isVideoOrAudioOrImgOrPdf( head.value?.contentType );
})

const generate_presign_get_url = async () => {
    if (!is_head_loaded.value) return;
    if (!props.bucket || !props.objectKey) return;
    const data = await presignGet({ providerId: props.bucket?.providerId, bucket: props.bucket?.bucket, key: props.objectKey });
    presign_get_url.value = data;
};

const copy_presign_get_url = async () => {
    if (!presign_get_url.value) return;
    await navigator.clipboard.writeText(presign_get_url.value.url);
    alert('Copied');
}

const download_object = async () => {
    if (!is_head_loaded.value) return;
    if (!props.bucket || !head.value?.bucket || !head.value?.key || !head.value?.name ) return;
    downloadFile(props.bucket?.providerId, head.value?.bucket, head.value?.key, head.value?.name);
}
const preview_object = async () => {
    if (!is_head_loaded.value) return;
    if (!props.bucket || !head.value?.bucket || !head.value?.key) return;
    openInNewTab(props.bucket?.providerId, head.value?.bucket, head.value?.key);
}
const emit = defineEmits<{
    (e: 'close'): void
}>()

/** 로딩 오버레이 */
const overlay = ref(false)
function handleClose() {
    emit('close')
}

watch(() => props.objectKey, (val, oldVal) => {
    if (val) {
        if (val != oldVal)
            getData(true);
    }
});

const formatDate = (date: Date | null | undefined) => {
    if (date)
        return dayjs(date).format("YYYY-MM-DD HH:mm:ss");
    else
        return ""
}
const formatComma = (value: number | string | undefined) => {
    const num = Number(value) || 0;
    return num.toLocaleString("ko-KR");
};

async function getData(force: boolean = false) {
    overlay.value = true;
    if (force) {
        if (props.bucket && props.objectKey) {
            const data = await fetchObjectHead({ providerId: props.bucket.providerId, bucket: props.bucket.bucket, key: props.objectKey });
            head.value = data;
            presign_get_url.value = undefined;
        }
    }
    overlay.value = false;
}

onMounted(() => {
    getData(true);
});

</script>
