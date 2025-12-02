// src/plugins/confirm.ts
import { type App, inject, reactive } from 'vue';

type ConfirmOptions = {
  title?: string;
  message?: string;
  okText?: string;
  cancelText?: string;
  color?: string;       // 'primary' | 'error' | ...
  persistent?: boolean; // 배경 클릭 닫힘 방지
};

const STATE = Symbol('confirm-state');
const API = Symbol('confirm-api');

const state = reactive({
  open: false,
  title: '확인',
  message: '',
  okText: '확인',
  cancelText: '취소',
  color: 'primary',
  persistent: true,
  _resolve: null as null | ((ok: boolean) => void),
});

function confirm(opts: ConfirmOptions = {}): Promise<boolean> {
  Object.assign(state, {
    open: true,
    title: opts.title ?? '확인',
    message: opts.message ?? '',
    okText: opts.okText ?? '확인',
    cancelText: opts.cancelText ?? '취소',
    color: opts.color ?? 'primary',
    persistent: opts.persistent ?? true,
  });
  return new Promise<boolean>((resolve) => (state._resolve = resolve));
}

function resolve(ok: boolean) {
  if (state._resolve) state._resolve(ok);
  state.open = false;
  state._resolve = null;
}

export default {
  install(app: App) {
    app.provide(STATE, state);
    app.provide(API, { confirm, resolve });
    (app.config.globalProperties as any).$confirm = confirm; // Options API 지원
  },
};

export const useConfirm = () => inject<{ confirm: typeof confirm; resolve: typeof resolve }>(API)!.confirm;
export const useConfirmState = () => inject<typeof state>(STATE)!;
export const useConfirmResolve = () => inject<{ confirm: typeof confirm; resolve: typeof resolve }>(API)!.resolve;
