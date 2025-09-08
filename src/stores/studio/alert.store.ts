import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAuthStore } from './auth.store';

interface Alert {
  type?: string;
  message?: any;
}

export const useAlertStore = defineStore('alert', () => {
  // STATE
  const alert = ref<Alert>({ type: 'none' });
  const has = ref(false);
  const authStore = useAuthStore();

  // GETTERS
  const hasAlert = computed(() => {
    return has.value;
  });

  const tokenExceptions = [
    'io.jsonwebtoken.SignatureException',
    'ErrorType2',
    'ErrorType3',
  ];

  const tokenExpired = computed(() => {
    if (
      alert.value.message === null ||
      alert.value.message.response === undefined
    )
      return false;
    if (alert.value.message.response.data.error === undefined) return false;
    if (
      tokenExceptions.includes(
        alert.value.message.response.data.error.exception
      )
    )
      return true;
    if (
      alert.value.message.response.data.error.exception ===
      'org.springframework.security.access.AccessDeniedException'
    ) {
      authStore.logout();
      return true;
    } else {
      return false;
    }
  });

  const unauthorized = computed(() => {
    if (
      alert.value.message &&
      alert.value.message.response &&
      alert.value.message.response.status === 401
    )
      return true;
    else return false;
  });

  // ACTIONS
  function success(message: any): void {
    has.value = true;
    alert.value = { message, type: 'success' };
  }

  function error(message: any): void {
    has.value = true;
    alert.value = { message, type: 'error' };
  }

  function clear(): void {
    has.value = false;
    alert.value = { type: 'none' };
  }

  return { alert, hasAlert, tokenExpired, unauthorized, success, error, clear };
});
