<template>
  <v-breadcrumbs class="pa-0" :items="['서비스 관리', 'AI', 'Chat Model']" density="compact"></v-breadcrumbs>
  <PageToolbar title="Chat Model" :label="modelLabel" :closeable="false" :divider="true" :items="[
    { icon: 'mdi-refresh', event: 'refresh', }]" @refresh="getData(true)"></PageToolbar>
  <v-card density="compact" class="mt-5">
    <v-container class="pb-0">
      <v-row>
        <v-col>
          <v-select prepend-icon="mdi-robot-outline" v-model="provider" :items="providerNames" label="Provider"
            placeholder="provider (옵션)" variant="underlined" @update:model-value="onProviderChange" />
        </v-col>
        <v-col>
          <v-text-field v-model="model" color="primary" label="Chat Model" placeholder="model (옵션)" readonly
            :error="error" :error-messages="error_message" variant="underlined"></v-text-field>
        </v-col>
        <v-col>
        </v-col>
      </v-row>
      <v-row no-gutters>
        <v-col cols="4">
          <v-textarea variant="underlined" v-model="systemPrompt" class="mx-2" label="systemPrompt"
            prepend-inner-icon="mdi-comment" rows="1" hint="모델의 기본 역할/스타일/제약을 한 번에 지정"></v-textarea>
        </v-col>
        <v-col><v-number-input v-model="temperature" :min="0.1" :max="1.0" :precision="1" hide-details="auto"
            label="temperature" variant="underlined" hint="창의성/무작위성. 낮을수록 사실 중심·결정적, 높을수록 다양/창의."></v-number-input>
        </v-col>
        <v-col><v-number-input v-model="topP" :min="0.1" :max="1.0" :precision="1" hide-details="auto" label="topP"
            variant="underlined" hint="확률 상위 누적분포 컷(nucleus sampling)"></v-number-input>
        </v-col>
        <v-col><v-number-input v-model="maxOutputTokens" :min="1" :precision="0" hide-details="auto"
            label="maxOutputTokens" variant="underlined" hint="한 번에 생성할 최대 토큰 수(응답 길이 상한)"></v-number-input>
        </v-col>
        <v-col>
          <v-textarea variant="underlined" class="mx-2" label="stopSequences" rows="1"
            hint="모델이 이 문자열(들)을 생성하면 즉시 중단. 후처리 없이 경계 제어가 필요할 때 사용"></v-textarea>
        </v-col>
      </v-row>
      <v-row no-gutters class="pb-0">
        <v-checkbox v-show="ragEnabled" v-model="usingRag" :label="ragLable" hide-details></v-checkbox>
      </v-row>
    </v-container>
    <v-expand-transition v-show="usingRag">
      <v-container class="py-0">
        <v-alert closable rounded="0" icon="mdi-tooltip" class="mb-2" :text="`애래 조건에 해당하는 문서 벡터의 조회 결과를 기반을 답변합니다.`"
          type="info" max-height="100"></v-alert>
        <v-row>
          <v-col><v-text-field variant="outlined" clearable label="object type" hint="예: board" density="compact"
              v-model="objectType"></v-text-field></v-col>
          <v-col><v-text-field variant="outlined" clearable label="object id" hint="예: board id value" density="compact"
              v-model="objectId"></v-text-field>
          </v-col>
          <v-col>
            <v-number-input :reverse="false" controlVariant="default" label="Rag TopK" :hideInput="false" :min="0" density="compact"
              v-model="ragTopK" :inset="false" variant="outlined"></v-number-input>
          </v-col>
          <v-col>
            <v-text-field label="쿼리" placeholder="쿼리을 입력하세요." row-height="15" rows="2" hide-details v-model="ragQuery" density="compact"
              variant="outlined"></v-text-field>
          </v-col>
        </v-row>
      </v-container>
    </v-expand-transition>
    <v-card-text class="overflow-y-auto" style="max-height: 500px">
      <v-timeline side="end">
        <v-timeline-item v-for="(m, i) in messages" :key="i" :data-role="m.role" :dot-color="roleColor(m.role)"
          :icon="roleIcon(m.role)" size="small" fill-dot>
          <v-alert :color="roleColor(m.role)" :value="true">
            <div class="d-flex justify-space-between align-center mb-1">
              <div v-if="m.role === 'assistant'" class="d-flex align-center flex-wrap ga-1">
                <v-chip size="x-small" variant="text" color="primary">
                  {{ m.model ?? model }}
                </v-chip>
                <v-chip v-if="m.tokenUsage" size="x-small" variant="tonal" color="secondary">
                  in: {{ m.tokenUsage.inputTokens }}
                  · out: {{ m.tokenUsage.outputTokens }}
                  · tot: {{ m.tokenUsage.totalTokens }}
                </v-chip>
              </div>
            </div>
            <div>{{ m.content }}</div>
          </v-alert>
        </v-timeline-item>
      </v-timeline>
    </v-card-text>
    <v-card-actions>
      <v-container fluid>
        <v-textarea label="Text" v-model="input" counter @keydown.enter.exact.prevent="onSend" row-height="15" rows="2">
          <template v-slot:append>
            <v-btn :loading="sending" icon="mdi-arrow-up-circle-outline" variant="tonal" @click="onSend"
              :disabled="!canSend"></v-btn>
          </template>
        </v-textarea>
      </v-container>
    </v-card-actions>
    <v-overlay v-model="overlay" contained class="align-center justify-center">
      <v-progress-circular color="primary" indeterminate size="64" />
    </v-overlay>
  </v-card>
</template>
<script setup lang="ts">
import PageToolbar from '@/components/bars/PageToolbar.vue';
import { fetchProviders, sendChat, setdRagChat } from '@/data/studio/public/ai';
import { useToast } from '@/plugins/toast';
import type { AiInfoResponse, ChatMessageDto, ChatRagRequestDto, ChatRequestDto, ProviderInfo, Role, TokenUsageDto } from "@/types/studio/ai";
import { resolveAxiosError } from '@/utils/helpers';
import { computed, nextTick, onMounted, ref } from 'vue';

const toast = useToast();

const model = ref("gemini-2.0-flash"); // 필요시 기본값 교체
const systemPrompt = ref<string>();
const temperature = ref<number>();
const topP = ref<number>();
const maxOutputTokens = ref<number>();
const stopSequences = ref<string[]>();
const ragEnabled = ref<boolean>(false);
const shwoRag = ref<boolean>(false);
const provider = ref("google-ai-gemini");                    // 필요시 사용
const input = ref("");

const modelLabel = computed(() => {
  const p = provider.value || "n/a";
  const m = model.value || "n/a";
  return `${p} · ${m}`;
});


const error = computed(() => {
  if (model.value || model.value != '')
    return false
  else return true;
});
const error_message = computed((): string | readonly string[] | null | undefined => {
  if (error.value) {
    return "이용 가능한 모델이 없습니다. 다른 프로파이더를 선택해주세요.";
  } else {
    if (!isChatEnabled(provider.value)) {
      return "이용이 불가능한 모델입니다. 다른 프로파이더를 선택해주세요.";
    }
    return undefined;
  }
});

const usingRag = ref<boolean>(ragEnabled.value);
const ragLable = computed(() => usingRag.value ? "RAG : 뢀성화" : "RAG : 비활성화")
const ragQuery = ref<string>();
const ragTopK = ref<number>();
const objectType = ref<string>();
const objectId = ref<string>();


const sending = ref(false);

interface ChatMessage extends ChatMessageDto {
  model?: string;
  tokenUsage?: TokenUsageDto;
}
const messages = ref<ChatMessage[]>([
  // 초기 system 프롬프트가 있으면 추가
  // { role: "system", content: "You are a helpful assistant." }
]);

const canSend = computed(() => !error.value && input.value.trim().length > 0 && !sending.value);

async function onSend() {
  if (!canSend.value) return;

  const userMsg: ChatMessageDto = { role: "user", content: input.value.trim() };
  messages.value.push(userMsg);

  input.value = "";
  await nextTick();
  sending.value = true;
  try {

    const req: ChatRequestDto = {
      provider: provider.value || undefined,
      model: model.value || undefined,
      messages: messages.value,
      systemPrompt: systemPrompt.value || undefined,
      temperature: temperature.value || undefined,
      topP: topP.value || undefined,
      maxOutputTokens: maxOutputTokens.value || undefined,
      // 필요시 옵션 추가
      // temperature: 0.2,
      // maxOutputTokens: 1024,
    };

    let resp;

    if (ragEnabled.value && usingRag.value) {
      console.log('rag chat')
      const ragReq: ChatRagRequestDto = {
        chat: req,
        objectType: objectType.value || undefined,
        objectId: objectId.value || undefined,
        ragQuery: ragQuery.value || undefined,
        ragTopK: ragTopK.value || undefined,
      }
      resp = await setdRagChat(ragReq)

    } else {
      console.log('chat')
      resp = await sendChat(req);
    }

    const usedModel = resp.model ?? model.value;
    const tokenUsage = resp.metadata?.tokenUsage as TokenUsageDto;

    // 응답 메시지(보통 마지막이 assistant)
    // 백엔드 응답이 전체 콘텍스트 형태라면 통째로 교체하거나, 새 assistant만 찾아 append
    // 여기서는 단순히 가장 마지막 assistant만 추가해 보여주는 패턴:
    const lastAssistant = [...resp.messages].reverse().find(m => m.role === "assistant");
    if (lastAssistant) {
      const assistantMsg: ChatMessage = {
        ...lastAssistant,
        model: usedModel,
        tokenUsage,
      };
      messages.value.push(assistantMsg);
    } else {
      // 전체를 서버 권위로 교체하려면:
      // messages.value = resp.messages;
    }
    // resp.metadata/resp.model 필요시 UI에 표시
  } catch (e: any) {
    messages.value.push({ role: "assistant", content: `⚠️ 오류: ${e?.message ?? e}`, model: model.value });
  } finally {
    sending.value = false;
    input.value = "";
  }
}

function roleLabel(role: Role) {
  return role === "user" ? "나" : role === "assistant" ? "AI" : "시스템";
}

const roleColor = (role: Role) => {
  if (role == 'assistant') return 'transparent';
  else return 'grey-lighten-2';
};

const roleIcon = (role: Role) => {
  if (role == 'assistant') return 'mdi-robot-outline';
  else return 'mdi-chat';
};

const overlay = ref(false);
const aiInfo = ref<AiInfoResponse | null>(null);
const providers = computed<ProviderInfo[]>(() => aiInfo.value?.providers ?? []);
const providerNames = computed<string[]>(
  () => aiInfo.value?.providers?.map(p => p.name) ?? []
);
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
  overlay.value = true;
  if (force) {
    try {
      const data = await fetchProviders();
      aiInfo.value = data;
      if (aiInfo.value)
        provider.value = aiInfo.value.defaultProvider;
      ragEnabled.value = aiInfo.value.vector.available;
      setChatModel(provider.value);
    } catch (e: any) {
      toast.error(resolveAxiosError(e));
    } finally {
      overlay.value = false;
    }
  }
}


onMounted(() => {
  getData(true);
});


</script>
