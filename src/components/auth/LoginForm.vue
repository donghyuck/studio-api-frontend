<script setup lang="ts">
import { useAuthStore } from '@/stores/studio/mgmt/auth.store';
import { useField, useForm } from 'vee-validate';
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import * as yup from 'yup';
import PasswordResetDialog from './PasswordResetDialog.vue';

const auth = useAuthStore();
const router = useRouter();
const errorMessage = ref('');
const loading = ref(false);
const remember = ref(false);
const showPassword = ref(false);
const usernameRef = ref<HTMLInputElement | null>(null);

onMounted(() => {
  remember.value = localStorage.getItem('remember_device') === 'yes';
});

const schema = yup.object({
  username: yup.string().required('아이디를 입력하세요'),
  password: yup
    .string()
    .min(6, '비밀번호는 최소 6자 이상입니다')
    .required('비밀번호를 입력하세요'),
});

const { handleSubmit } = useForm({ validationSchema: schema });
const { value: username, errorMessage: usernameError } = useField('username');
const { value: password, errorMessage: passwordError } = useField('password');

const usernameErrors = computed(() =>
  usernameError.value ? [usernameError.value] : []
);
const passwordErrors = computed(() =>
  passwordError.value ? [passwordError.value] : []
);

const login = handleSubmit(async (values) => {
  errorMessage.value = '';
  loading.value = true;
  try {
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

const dialog = ref({
  visible: false
});
 
function passwoard_reset (){
  dialog.value.visible = true;
}
</script>
<template>
  <v-form @submit.prevent="login">
    <v-row class="d-flex mb-3">
      <v-col cols="12">
        <v-label class="font-weight-bold mb-1">아이디</v-label>
        <v-text-field ref="usernameRef" v-model="username" :error-messages="usernameErrors" variant="outlined"
          color="primary" />
      </v-col>
      <v-col cols="12">
        <v-label class="font-weight-bold mb-1">비밀번호</v-label>
        <v-text-field v-model="password" :error-messages="passwordErrors" :type="showPassword ? 'text' : 'password'"
          variant="outlined" color="primary" :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
          @click:append-inner="showPassword = !showPassword" />
      </v-col>
      <v-col cols="12" class="pt-0">
        <div class="d-flex flex-wrap align-center ml-n2">
          <div class="ml-sm-auto"> 
            <v-btn  :disabled="dialog.visible" color="primary" variant="plain" size="large" @click="passwoard_reset">
              비밀번호 재설정
            </v-btn>
          </div>
        </div>
      </v-col>
      <v-col cols="12" class="pt-0">
        <v-btn :loading="loading" type="submit" color="primary" size="large" block flat>
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
  <PasswordResetDialog v-model="dialog.visible" @close="dialog.visible = false"></PasswordResetDialog>
</template>
