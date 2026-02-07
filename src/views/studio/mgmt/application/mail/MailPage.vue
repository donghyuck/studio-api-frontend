<template>
    <v-breadcrumbs class="pa-0" :items="['응용프로그램', '메일', '메일 Inbox']" density="compact"></v-breadcrumbs>
    <PageToolbar title="메일 Inbox" label="" :previous="true" :closeable="false" :divider="true" :items="[
        { icon: 'mdi-refresh', event: 'refresh', }]"></PageToolbar>
    <v-row>
        <v-col cols="12" md="12">
            <v-card class="mx-auto mt-2" density="compact">
                <v-card-title class="text-grey-darken-4 d-flex flex-column ga-2 bg-blue-lighten-5">
                    <div class="d-flex align-center ga-2">
                        <span class="text-h6">{{ mailMessage?.subject || "(제목 없음)" }}</span>
                        <v-chip v-if="mailMessage?.folder" size="small" variant="tonal">
                            {{ mailMessage.folder }}
                        </v-chip>
                    </div>
                    <div class="mail-meta text-caption">
                        <span class="text-medium-emphasis">Message-Id: {{ mailMessage?.messageId || "-" }}</span>
                        <span class="meta-sep">·</span>
                        <span class="text-medium-emphasis">발신: {{ formatDate(mailMessage?.sentAt) }}</span>
                        <span class="meta-sep">·</span>
                        <span class="text-medium-emphasis">수신: {{ formatDate(mailMessage?.receivedAt) }}</span>
                    </div>
                </v-card-title>
                <v-divider class="mail-divider"></v-divider>
                <v-card-text class="pa-2">
                    <v-row class="info-grid" dense>
                        <v-col cols="12" md="6">
                            <div class="info-item">
                                <div class="info-label">보낸 사람</div>
                                <div v-if="mailMessage?.fromAddress" class="d-flex flex-wrap ga-2">
                                    <v-chip v-for="c in parseEmailHeader(mailMessage.fromAddress, { dedupe: true })"
                                        :key="(c.email ?? c.raw)" size="small" variant="tonal"
                                        :title="c.email ? `${c.label} <${c.email}>` : c.raw">
                                        {{ c.label }}
                                        <span v-if="c.email" class="ml-1 text-medium-emphasis">&lt;{{ c.email
                                        }}&gt;</span>
                                    </v-chip>
                                </div>
                            </div>
                        </v-col>
                        <v-col cols="12" md="6">
                            <div class="info-item">
                                <div class="info-label">받는 사람</div>
                                <div v-if="mailMessage?.toAddress" class="d-flex flex-wrap ga-2">
                                    <v-chip v-for="c in parseEmailHeader(mailMessage.toAddress, { dedupe: true })"
                                        :key="(c.email ?? c.raw)" size="small" variant="tonal"
                                        :title="c.email ? `${c.label} <${c.email}>` : c.raw">
                                        {{ c.label }}
                                        <span v-if="c.email" class="ml-1 text-medium-emphasis">&lt;{{ c.email
                                        }}&gt;</span>
                                    </v-chip>
                                </div>
                            </div>
                        </v-col>
                        <v-col v-if="hasCc" cols="12" md="6">
                            <div class="info-item">
                                <div class="info-label">참조</div>
                                <div v-if="mailMessage?.ccAddress" class="d-flex flex-wrap ga-2">
                                    <v-chip v-for="c in parseEmailHeader(mailMessage.ccAddress, { dedupe: true })"
                                        :key="(c.email ?? c.raw)" size="small" variant="tonal"
                                        :title="c.email ? `${c.label} <${c.email}>` : c.raw">
                                        {{ c.label }}
                                        <span v-if="c.email" class="ml-1 text-medium-emphasis">&lt;{{ c.email
                                            }}&gt;</span>
                                    </v-chip>
                                </div>
                            </div>
                        </v-col>
                        <v-col v-if="hasBcc" cols="12" md="6">
                            <div class="info-item">
                                <div class="info-label">숨은 참조</div>
                                <div v-if="mailMessage?.bccAddress" class="d-flex flex-wrap ga-2">
                                    <v-chip v-for="c in parseEmailHeader(mailMessage.bccAddress, { dedupe: true })"
                                        :key="(c.email ?? c.raw)" size="small" variant="tonal"
                                        :title="c.email ? `${c.label} <${c.email}>` : c.raw">
                                        {{ c.label }}
                                        <span v-if="c.email" class="ml-1 text-medium-emphasis">&lt;{{ c.email
                                            }}&gt;</span>
                                    </v-chip>
                                </div>
                            </div>
                        </v-col>
                    </v-row>
                </v-card-text>
                <v-card-actions class="py-0 pr-0 bg-grey-darken-1">
                    <v-spacer />
                    <v-switch v-model="showHtml" density="compact" size="sm" inset label="HTML 보기" width="150"
                        hide-details />
                </v-card-actions>
                <v-divider></v-divider>
                <v-card-text class="pa-0">
                    <div v-if="showHtml">
                        <div v-if="mailMessage?.body">
                            <v-ace-editor v-if="aceReady" v-model:value="htmlSource" lang="html" theme="chrome"
                                :options="{ useWorker: true, readOnly: true, wrap: true, highlightActiveLine: false, highlightGutterLine: false }"
                                style="min-height: 320px; width: 100%;" />
                            <div v-else class="d-flex align-center justify-center text-medium-emphasis"
                                style="min-height: 320px;">
                                로딩 중...
                            </div>
                        </div>
                        <div v-else class="pa-5">메일 본문이 없습니다.</div>
                    </div>
                    <perfect-scrollbar v-else class="scrollnavbar text-black bg-white" style="max-height: 500px;">
                        <div v-if="mailMessage?.body" v-html="mailMessage.body" class="pa-5">
                        </div>
                        <div v-else class="pa-5">메일 본문이 없습니다.</div>
                    </perfect-scrollbar>
                </v-card-text>
                <v-divider v-if="hasAttachments" class="mail-divider"></v-divider>
                <v-card-text v-if="hasAttachments" class="pa-2">
                    <div class="info-item">
                        <div class="info-label">첨부파일</div>
                        <v-table theme="dark" density="compact">
                            <thead>
                                <tr>
                                    <th class="text-left">파일명</th>
                                    <th class="text-right">크기</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="file in mailMessage?.attachments" :key="file.attachmentId">
                                    <td><span class="mdi mdi-paperclip"></span> {{ file.filename }}</td>
                                    <td class="text-right">{{ formatBytes(file.size) }}</td>
                                </tr>
                            </tbody>
                        </v-table>
                    </div>
                </v-card-text>
            </v-card>
            <v-overlay v-model="overlay" contained class="align-center justify-center">
                <v-progress-circular color="primary" indeterminate size="64" />
            </v-overlay>
        </v-col>
    </v-row>
</template>
<script setup lang="ts">
import PageToolbar from '@/components/bars/PageToolbar.vue';
import { loadAce } from '@/components/ace';
import { useConfirm } from '@/plugins/confirm';
import { useToast } from '@/plugins/toast';
import { usePageableMailInboxStore } from '@/stores/studio/mgmt/mail.inbox.store';
import type { MailMessageDto } from '@/types/studio/mail';
import { parseEmailHeader } from '@/utils/mail';
import { computed, onMounted, ref, watch } from 'vue';
import { VAceEditor } from 'vue3-ace-editor';

const toast = useToast();
const confirm = useConfirm();
const overlay = ref(false);
const showHtml = ref(false);
const aceReady = ref(false);
const aceLoadSeq = ref(0);
const htmlSource = ref('');

const props = defineProps({
    mailId: { type: Number, default: 0 },
});

const mailMessage = ref<MailMessageDto>();
const hasCc = computed(() => !!mailMessage.value?.ccAddress);
const hasBcc = computed(() => !!mailMessage.value?.bccAddress);
const hasAttachments = computed(
    () => (mailMessage.value?.attachments?.length ?? 0) > 0
);

async function ensureAceReady() {
    if (aceReady.value) return;
    const seq = ++aceLoadSeq.value;
    await loadAce("html", "chrome");
    if (seq !== aceLoadSeq.value) return;
    aceReady.value = true;
}

function formatDate(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
}

function formatBytes(bytes?: number) {
    if (bytes == null) return "-";
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let size = bytes / 1024;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }
    return `${size.toFixed(size < 10 ? 1 : 0)} ${units[unitIndex]}`;
}


const dataStore = usePageableMailInboxStore();
async function getData(force: boolean = false) {
    overlay.value = true;
    try {
        const data = await dataStore.byId(props.mailId)
        if (data) {
            // process data
            mailMessage.value = data;
        }
    } finally {
        overlay.value = false;
    }
}
const refresh = () => {
    getData()
}

onMounted(() => {
    if (props.mailId > 0) {
        getData();
    }
    if (showHtml.value) {
        ensureAceReady();
    }
});

watch(showHtml, (enabled) => {
    if (enabled) {
        ensureAceReady();
    }
});

watch(
    mailMessage,
    (message) => {
        htmlSource.value = message?.body ?? '';
    },
    { immediate: true }
);
</script>
<style scoped>
.mail-body {
    white-space: pre-wrap;
    word-break: break-word;
    background-color: white;
}

.mail-body-scroll {
    max-height: 360px;
    overflow: auto;
}

.plain-text {
    white-space: pre-wrap;
    word-break: break-word;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 13px;
    background: rgba(0, 0, 0, 0.03);
    padding: 12px;
    border-radius: 6px;
}

.info-grid {
    gap: 8px 0;
}

.info-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 12px;
    border: 1px solid rgba(0, 0, 0, 0.06);
    border-radius: 8px;
}

.info-label {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.6);
}

.info-value {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.mail-header {
    background: rgba(25, 118, 210, 0.08);
}

.mail-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
}

.meta-sep {
    color: rgba(0, 0, 0, 0.3);
}

.mail-divider {
    border-top: 1px dashed rgba(0, 0, 0, 0.35);
}
</style>
