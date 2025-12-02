// src/plugins/toast.ts
import { type App, inject, reactive } from 'vue';

export type ToastOptions = {
  color?: string;           // 'success' | 'info' | 'warning' | 'error' | 'primary' ...
  timeout?: number;         // ms
  location?: string;        // 'top', 'bottom', 'top right', 'bottom left' ...
  icon?: string;            // 'mdi-check', 'mdi-alert', ...
};

const TOAST_STATE = Symbol('toast-state');
const TOAST_API   = Symbol('toast-api');

const state = reactive({
  show: false,
  message: '',
  color: 'success',
  timeout: 2500,
  location: 'top right',
  icon: '',
});

function show(message: string, opts: ToastOptions = {}) {
  Object.assign(state, { show: true, message, ...opts });
}
const api = {
  show,
  success: (m: string, o: ToastOptions = {}) => show(m, { color: 'success', icon: 'mdi-check', ...o }),
  info:    (m: string, o: ToastOptions = {}) => show(m, { color: 'info',    icon: 'mdi-information', ...o }),
  warning: (m: string, o: ToastOptions = {}) => show(m, { color: 'warning', icon: 'mdi-alert', ...o }),
  error:   (m: string, o: ToastOptions = {}) => show(m, { color: 'error',   icon: 'mdi-alert-octagon', ...o }),
  close:   () => (state.show = false),
};

export default {
  install(app: App) {
    app.provide(TOAST_STATE, state);
    app.provide(TOAST_API, api);
    (app.config.globalProperties as any).$toast = api; // Options API에서도 this.$toast 사용 가능
  },
};

export const useToast = () => inject<typeof api>(TOAST_API)!;
export const useToastState = () => inject<typeof state>(TOAST_STATE)!;
