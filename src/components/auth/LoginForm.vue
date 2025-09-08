<script setup lang="ts">
import { useAuthStore } from '@/stores/studio/auth.store';
import { useRouter, RouterLink } from 'vue-router';
import { useForm, useField } from 'vee-validate';
import * as yup from 'yup';
import { ref, onMounted, nextTick, computed } from 'vue';

// ✅ 스토어, 라우터, 상태
const auth = useAuthStore();
const router = useRouter();
const errorMessage = ref('');
const loading = ref(false);
const remember = ref(false);
const showPassword = ref(false);
const usernameRef = ref<HTMLInputElement | null>(null);

// ✅ Remember me 초기화
onMounted(() => {
  remember.value = localStorage.getItem('remember_device') === 'yes';
});

// ✅ 유효성 검사 스키마
const schema = yup.object({
  username: yup.string().required('아이디를 입력하세요'),
  password: yup
    .string()
    .min(6, '비밀번호는 최소 6자 이상입니다')
    .required('비밀번호를 입력하세요'),
});

// ✅ vee-validate form 초기화
const { handleSubmit } = useForm({ validationSchema: schema });

// ✅ 각 필드 선언 (useField)
const { value: username, errorMessage: usernameError } = useField('username');
const { value: password, errorMessage: passwordError } = useField('password');

// ✅ Vuetify용 errorMessages 변환 (배열)
const usernameErrors = computed(() =>
  usernameError.value ? [usernameError.value] : []
);
const passwordErrors = computed(() =>
  passwordError.value ? [passwordError.value] : []
);

// ✅ 로그인 처리
const login = handleSubmit(async (values) => {
  errorMessage.value = '';
  loading.value = true;
  try {
    // remember 처리
    if (remember.value) {
      localStorage.setItem('remember_device', 'yes');
    } else {
      localStorage.removeItem('remember_device');
    }

    await auth.login(values.username, values.password);

    router.push('/');
  } catch (e: any) {
    errorMessage.value =
      e.message || '로그인 실패: 아이디 또는 비밀번호 확인';
    nextTick(() => {
      usernameRef.value?.focus();
    });
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <v-form @submit.prevent="login">
    <v-row class="d-flex mb-3">
      <v-col cols="12">
        <v-label class="font-weight-bold mb-1">아이디</v-label>
        <v-text-field
          ref="usernameRef"
          v-model="username"
          :error-messages="usernameErrors"
          variant="outlined" 
          color="primary"
        />
      </v-col>

      <v-col cols="12">
        <v-label class="font-weight-bold mb-1">비밀번호</v-label>
        <v-text-field
          v-model="password"
          :error-messages="passwordErrors"
          :type="showPassword ? 'text' : 'password'"
          variant="outlined" 
          color="primary"
          :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
          @click:append-inner="showPassword = !showPassword"
        />
      </v-col>

      <v-col cols="12" class="pt-0">
        <div class="d-flex flex-wrap align-center ml-n2">
          <v-checkbox v-model="remember" color="primary" hide-details>
            <template v-slot:label>
              <span class="text-body-1">Remember this Device</span>
            </template>
          </v-checkbox>
          <div class="ml-sm-auto">
            <RouterLink
              to="/"
              class="text-primary text-decoration-none text-body-1 opacity-1 font-weight-medium"
            >
              비밀번호 찾기
            </RouterLink>
          </div>
        </div>
      </v-col>

      <v-col cols="12" class="pt-0">
        <v-btn
          :loading="loading"
          type="submit"
          color="primary"
          size="large"
          block
          flat
        >
          로그인
        </v-btn>
      </v-col>
      <v-col cols="12" v-if="errorMessage" class="pt-2">
        <v-alert type="error" variant="tonal" color="error" border="start">
          {{ errorMessage }}
        </v-alert>
      </v-col>
    </v-row>
  </v-form>
</template>
