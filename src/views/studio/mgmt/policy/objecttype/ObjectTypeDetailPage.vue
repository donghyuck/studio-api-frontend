<template>
  <v-breadcrumbs class="pa-0" :items="['응용프로그램', '자원', '객체 유형']" density="compact" />
  <PageToolbar :title="isCreate ? '객체 유형 생성' : '객체 유형 상세'" :label="isCreate ? '새 객체 유형을 생성합니다.' : '객체 유형을 수정합니다.'"
    :previous="true" :closeable="false" :divider="true"
    :items="[{ icon: 'mdi-refresh', event: 'refresh', tooltip: '새로고침' }]" @refresh="refresh" />
  <v-card class="mt-2">
    <v-card-text>
      <v-skeleton-loader type="article" :loading="loading" min-width="100%">
        <v-alert type="info" variant="tonal" density="compact" class="mb-3">
          <div class="text-body-2">
            객체 유형의 기본 정보를 입력합니다. 이 정보는 객체 분류, 권한/정책 적용, 검색/필터링, UI 노출,
            데이터 정합성 관리에 활용됩니다.
          </div>
          <ul class="text-body-2 mt-2 ps-4">
            <li>코드: API 경로/정책 규칙/권한 체크에서 사용하는 고유 식별자입니다.</li>
            <li>이름: 관리자/사용자 화면에 표시되는 유형명으로, 목록/상세에서 식별에 사용됩니다.</li>
            <li>도메인: 객체를 논리적 그룹으로 묶어 필터링, 통계 집계, 접근 제어 범위 지정에 활용됩니다.</li>
            <li>상태: 비활성/Deprecated 시 신규 등록 제한, 기존 데이터만 조회 허용 등의 운영 정책에 사용됩니다.</li>
            <li>객체 유형: 내부 관리 ID로, 백오피스/로그/정책 매핑에서 기준값으로 사용됩니다.</li>
          </ul>
          <div class="text-body-2 mt-2">
            예) <strong>domain=media</strong>인 객체는 미디어 권한 정책과 스토리지 정책이 적용되고, 검색 시
            media 도메인 필터로 조회할 수 있습니다.
          </div>
          <div class="text-body-2 mt-2">
            게시물 첨부파일 예) 게시물의 파일 업로드/다운로드는 이 객체 유형을 기준으로 확장자/용량/MIME
            제한이 적용되며, 목록 필터나 권한 정책에서도 동일한 코드/도메인을 기준으로 제어할 수 있습니다.
          </div>
        </v-alert>
        <v-row>
          <v-col cols="3" class="pb-0">
            <v-number-input v-model="objectType" :reverse="false" controlVariant="default" label="객체 유형"
              :hideInput="false" hide-details density="compact" :min="0" :inset="false" :disabled="!isCreate" />
          </v-col>
          <v-col cols="3" class="pb-0">
            <v-text-field v-model="code" label="코드" density="compact" :error="!!errors.code"
              :error-messages="errors.code" @blur="validateField('code')" />
          </v-col>
          <v-col cols="3" class="pb-0">
            <v-text-field v-model="name" label="이름" density="compact" :error="!!errors.name"
              :error-messages="errors.name" @blur="validateField('name')" />
          </v-col>
          <v-col cols="3" class="pb-0">
            <v-text-field v-model="domain" label="도메인" density="compact" :error="!!errors.domain"
              :error-messages="errors.domain" @blur="validateField('domain')" />
          </v-col>
          <v-col cols="3" class="pb-0">
            <v-select v-model="status" :items="statusOptions" label="상태" density="compact" :error="!!errors.status"
              :error-messages="errors.status" @blur="validateField('status')" />
          </v-col>
          <v-col cols="9" class="pb-0">
            <v-textarea v-model="description" label="설명" rows="1" density="compact" auto-grow hide-details />
          </v-col>
        </v-row>
      </v-skeleton-loader>
    </v-card-text>
    <v-card-actions>
      <v-spacer />
      <v-btn variant="tonal" color="grey" rounded="xl" width="100" @click="goBack">
        Cancel
      </v-btn>
      <v-btn variant="outlined" prepend-icon="mdi-content-save" rounded="xl" color="primary" width="100"
        density="default" :loading="saving" @click="onSubmit">
        Save
      </v-btn>
    </v-card-actions>
  </v-card>

  <v-expansion-panels v-if="showPolicy" class="mt-3" variant="popout">
    <v-expansion-panel>
      <v-expansion-panel-title collapse-icon="mdi-minus" expand-icon="mdi-plus">
        <v-icon color="primary" class="me-2">mdi-security</v-icon>
        정책
      </v-expansion-panel-title>
      <v-expansion-panel-text>
        <v-alert type="info" variant="tonal" density="compact" class="mb-3" closable>
          <div class="text-body-2">
            아래 항목은 객체 업로드/다운로드 시 정책으로 적용됩니다.
          </div>
          <ul class="text-body-2 mt-2 ps-4">
            <li>Max File (MB): 단일 파일의 최대 허용 크기(MB). 초과 시 업로드가 차단됩니다.</li>
            <li>허용 확장자: 업로드 가능한 파일 확장자 목록(쉼표로 구분). 예: jpg,png,pdf</li>
            <li>허용 MIME: 업로드 가능한 MIME 타입 목록(쉼표로 구분, 와일드카드 가능). 예: image/*</li>
            <li>정책 JSON: 추가 정책을 JSON으로 정의. 예: 파일 개수 제한, 해상도 제한 등.</li>
          </ul>
          <div class="text-body-2 mt-2">정책 JSON 예시</div>
          <pre class="text-body-2 mt-1 mb-0" v-pre>{
  "maxFiles": 5,
  "maxTotalSizeMb": 200,
  "maxWidth": 1920,
  "maxHeight": 1080,
  "requireVirusScan": true
}</pre>
        </v-alert>
        <v-row>
          <v-col cols="3" class="pb-0">
            <v-number-input v-model="policyMaxFileMb" :reverse="false" controlVariant="default" label="Max File (MB)"
              :hideInput="false" hide-details density="compact" :min="0" :inset="false" />
          </v-col>
          <v-col cols="4" class="pb-0">
            <v-text-field v-model="policyAllowedExt" label="허용 확장자" density="compact" placeholder="jpg,png,pdf"
              hide-details />
          </v-col>
          <v-col cols="5" class="pb-0">
            <v-text-field v-model="policyAllowedMime" label="허용 MIME" density="compact"
              placeholder="image/*,application/pdf" hide-details />
          </v-col>
          <v-col cols="12" class="pb-0">
            <v-textarea v-model="policyJson" label="정책 JSON" rows="4" density="compact" auto-grow />
          </v-col>
        </v-row>
        <div class="d-flex justify-end mt-2">
          <v-btn variant="outlined" prepend-icon="mdi-content-save" rounded="xl" color="primary" width="100"
            :loading="policySaving" @click="savePolicy">
            저장
          </v-btn>
        </div>
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script setup lang="ts">
import PageToolbar from "@/components/bars/PageToolbar.vue";
import { objectTypeAdminApi } from "@/data/studio/mgmt/objecttype";
import { useAuthStore } from "@/stores/studio/mgmt/auth.store";
import { useToast } from "@/plugins/toast";
import type {
  ObjectTypeDto,
  ObjectTypePolicyDto,
  ObjectTypePolicyUpsertRequest,
  ObjectTypeUpsertRequest,
} from "@/types/studio/objecttype";
import { computed, ref, watch } from "vue";
import { useForm } from "vee-validate";
import * as yup from "yup";
import { useRouter } from "vue-router";

const props = defineProps({
  objectType: { type: Number, default: 0 },
  isCreate: { type: Boolean, default: false },
});

const router = useRouter();
const toast = useToast();
const auth = useAuthStore();

const loading = ref(false);
const saving = ref(false);
const policySaving = ref(false);

const statusOptions = [
  { title: "활성", value: "ACTIVE" },
  { title: "Deprecated", value: "DEPRECATED" },
  { title: "비활성", value: "DISABLED" },
];

const schema = yup.object({
  objectType: yup.number().integer().min(0).nullable(),
  code: yup
    .string()
    .required("코드는 필수입니다.")
    .matches(/^[a-z][a-z0-9_-]{1,79}$/, "코드 형식이 올바르지 않습니다."),
  name: yup.string().required("이름은 필수입니다."),
  domain: yup.string().required("도메인은 필수입니다."),
  status: yup.string().required("상태는 필수입니다."),
  description: yup.string().nullable(),
});

const {
  errors,
  validateField,
  handleSubmit,
  resetForm,
  useFieldModel,
} = useForm({
  validationSchema: schema,
  initialValues: {
    objectType: props.objectType || null,
    code: "",
    name: "",
    domain: "",
    status: "ACTIVE",
    description: "",
  },
  validateOnMount: false,
  validateOnBlur: true,
  validateOnChange: false,
  validateOnInput: false,
} as any);

const [objectType, code, name, domain, status, description] = useFieldModel([
  "objectType",
  "code",
  "name",
  "domain",
  "status",
  "description",
]);

const showPolicy = computed(
  () => !props.isCreate && Number(objectType.value ?? 0) > 0
);

const policy = ref<ObjectTypePolicyDto | null>(null);
const policyMaxFileMb = ref<number | null>(null);
const policyAllowedExt = ref<string | null>(null);
const policyAllowedMime = ref<string | null>(null);
const policyJson = ref<string | null>(null);

const loadPolicy = async (id: number) => {
  try {
    const data = await objectTypeAdminApi.getPolicy(id);
    policy.value = data;
    policyMaxFileMb.value = data.maxFileMb ?? null;
    policyAllowedExt.value = data.allowedExt ?? null;
    policyAllowedMime.value = data.allowedMime ?? null;
    policyJson.value = data.policyJson ?? null;
  } catch {
    policy.value = null;
    policyMaxFileMb.value = null;
    policyAllowedExt.value = null;
    policyAllowedMime.value = null;
    policyJson.value = null;
  }
};

const resetForCreate = () => {
  resetForm({
    values: {
      objectType: null,
      code: "",
      name: "",
      domain: "",
      status: "ACTIVE",
      description: "",
    },
  });
  policy.value = null;
  policyMaxFileMb.value = null;
  policyAllowedExt.value = null;
  policyAllowedMime.value = null;
  policyJson.value = null;
};

const load = async () => {
  if (props.isCreate || props.objectType <= 0) {
    resetForCreate();
    return;
  }
  loading.value = true;
  try {
    const data: ObjectTypeDto = await objectTypeAdminApi.get(props.objectType);
    resetForm({
      values: {
        objectType: data.objectType ?? null,
        code: data.code ?? "",
        name: data.name ?? "",
        domain: data.domain ?? "",
        status: (data.status ?? "ACTIVE") as string,
        description: data.description ?? "",
      },
    });
    await loadPolicy(Number(data.objectType));
  } finally {
    loading.value = false;
  }
};

const refresh = () => {
  load();
};

const goBack = () => {
  router.back();
};

const buildUpsertPayload = (base?: Partial<ObjectTypeUpsertRequest>) => {
  const userId = auth.user?.userId ?? 0;
  const username = auth.user?.username ?? "";
  if (!userId || !username) {
    throw new Error("사용자 정보를 확인할 수 없습니다.");
  }
  return {
    objectType: objectType.value ?? null,
    code: String(code.value ?? "").trim(),
    name: String(name.value ?? "").trim(),
    domain: String(domain.value ?? "").trim(),
    status: status.value ?? "ACTIVE",
    description: description.value ?? null,
    updatedBy: username,
    updatedById: userId,
    createdBy: username,
    createdById: userId,
    ...base,
  } as ObjectTypeUpsertRequest;
};

const onSubmit = handleSubmit(async () => {
  saving.value = true;
  try {
    const id = Number(objectType.value ?? 0);
    if (props.isCreate || id <= 0) {
      const payload = buildUpsertPayload();
      const created = await objectTypeAdminApi.create(payload);
      toast.success("객체 유형이 생성되었습니다.");
      router.replace({
        name: "ObjectTypeDetails",
        params: { objectType: created.objectType },
      });
    } else {
      const userId = auth.user?.userId ?? 0;
      const username = auth.user?.username ?? "";
      if (!userId || !username) {
        throw new Error("사용자 정보를 확인할 수 없습니다.");
      }
      await objectTypeAdminApi.patch(id, {
        code: String(code.value ?? "").trim() || null,
        name: String(name.value ?? "").trim() || null,
        domain: String(domain.value ?? "").trim() || null,
        status: status.value ?? null,
        description: description.value ?? null,
        updatedBy: username,
        updatedById: userId,
      });
      toast.success("객체 유형이 저장되었습니다.");
      await load();
    }
  } catch (error: any) {
    toast.error(error?.message ?? "저장에 실패했습니다.");
  } finally {
    saving.value = false;
  }
});

const savePolicy = async () => {
  const id = Number(objectType.value ?? 0);
  if (!id) return;
  const userId = auth.user?.userId ?? 0;
  const username = auth.user?.username ?? "";
  if (!userId || !username) {
    toast.error("사용자 정보를 확인할 수 없습니다.");
    return;
  }
  const createdBy = policy.value?.createdBy ?? username;
  const createdById = policy.value?.createdById ?? userId;
  const payload: ObjectTypePolicyUpsertRequest = {
    maxFileMb: policyMaxFileMb.value ?? null,
    allowedExt: policyAllowedExt.value ?? null,
    allowedMime: policyAllowedMime.value ?? null,
    policyJson: policyJson.value ?? null,
    updatedBy: username,
    updatedById: userId,
    createdBy: createdBy,
    createdById: Number(createdById),
  };
  policySaving.value = true;
  try {
    const data = await objectTypeAdminApi.upsertPolicy(id, payload);
    policy.value = data;
    toast.success("정책이 저장되었습니다.");
  } catch {
    toast.error("정책 저장에 실패했습니다.");
  } finally {
    policySaving.value = false;
  }
};

watch(
  () => [props.objectType, props.isCreate],
  () => {
    load();
  },
  { immediate: true }
);
</script>
