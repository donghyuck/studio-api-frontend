<script setup lang="ts">
import { useJwtCountdown } from '@/components/jwt/useJwtCountdown';
import { useConfirm } from '@/plugins/confirm';
import { useToast } from '@/plugins/toast';
import { useAuthStore } from '@/stores/studio/mgmt/auth.store';
import { usePreferencesStore } from '@/stores/studio/mgmt/preferences.store';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
const items = [
    { text: 'Top Menu1', icon: 'mdi-wifi-strength-3', url: '/' },
    { text: 'Top Menu2', icon: 'mdi-signal-cellular-outline', url: '/' },
    { text: 'Top Menu3', icon: 'mdi-timer-sand', url: '/' }
];
const auth = useAuthStore();
const tokenRef = computed(() => auth.token);
const { exp, showRefresh, showLogin, secondsToExpiry, hhmmssToExpiry, hhmmssGraceLeft, inGrace, statusText, isExpired } = useJwtCountdown(tokenRef, {
    // 없으면 생략 -> 내부 default 파서 사용
    graceSeconds: 1 * 60, // 5분
    tickMs: 1000,
    clockSkewSec: 3,
    preExpiryWindowSec: 60 * 10, // 10분 (UI 기본값은 prefs로 제어)
});
const nowEpoch = ref(Math.floor(Date.now() / 1000));
let nowTimer: number | null = null;
function applyFeatureTopbarHeight(hidden: boolean) {
    if (typeof document === 'undefined') return;
    document.documentElement.style.setProperty('--feature-topbar-height', hidden ? '0px' : '24px');
}
onMounted(() => {
    nowTimer = window.setInterval(() => {
        nowEpoch.value = Math.floor(Date.now() / 1000);
    }, 1000);
});
onUnmounted(() => {
    if (nowTimer != null) {
        window.clearInterval(nowTimer);
        nowTimer = null;
    }
    applyFeatureTopbarHeight(true);
});
const hideTopbar = computed(() => {
    if (!exp.value) return true;
    if (!isExpired.value) return false;
    // 만료 + 그레이스 종료 이후에는 상단바 숨김
    return !inGrace.value;
});
const topbarTone = computed(() => {
    if (isExpired.value && inGrace.value) return 'topbar-tone--grace';
    if (isExpired.value && !inGrace.value) return 'topbar-tone--expired';
    if (isExpirySoonLocal.value) return 'topbar-tone--soon';
    return 'topbar-tone--normal';
});
const confirm = useConfirm();
const toast = useToast();
const refreshing = ref(false);
const autoRefreshFailed = ref(false);
const prefs = usePreferencesStore();
const autoRefreshEnabled = computed({
    get: () => prefs.autoRefreshEnabled,
    set: (val) => { prefs.autoRefreshEnabled = val; },
});
const autoRefreshWindowSec = computed({
    get: () => prefs.autoRefreshWindowSec,
    set: (val) => { prefs.autoRefreshWindowSec = Number(val); },
});
const isExpirySoonLocal = computed(() => !isExpired.value && secondsToExpiry.value <= autoRefreshWindowSec.value);
const lastAutoRefreshAt = ref(0);

const autoRefresh = async () => {
    if (refreshing.value) return;
    refreshing.value = true;
    try {
        await auth.refreshTokens();
        lastAutoRefreshAt.value = Math.floor(Date.now() / 1000);
        autoRefreshFailed.value = false;
    } catch (e) {
        autoRefreshFailed.value = true;
        toast.error('자동 연장에 실패했습니다.');
        console.log('auto refresh error', e);
    } finally {
        refreshing.value = false;
    }
};

watch(
    () => [isExpirySoonLocal.value, isExpired.value, autoRefreshEnabled.value] as const,
    ([soon, expired, enabled]) => {
        if (!enabled) return;
        if (expired || !soon) return;
        const now = Math.floor(Date.now() / 1000);
        if (now - lastAutoRefreshAt.value < 60) return;
        autoRefresh();
    }
);

watch(hideTopbar, (hidden) => {
    applyFeatureTopbarHeight(hidden);
}, { immediate: true });

const refresh = async () => {
    const ok = await confirm({
        title: '확인',
        message: '인증을 갱신하시겠습니까?',
        okText: '예',
        cancelText: '아니오',
        color: 'primary',
    });
    if (!ok) return;
    refreshing.value = true;
    try {
        await auth.refreshTokens();
        autoRefreshFailed.value = false;
    } catch (e) {
        console.log('error', e);
    } finally {
        refreshing.value = false;
    }
}
const router = useRouter();
const goLogin = async () => {
    router.push({ name: 'Login' })
}
const logout = async () => {
    const ok = await confirm({
        title: '확인',
        message: '로그아웃 하시겠습니까?',
        okText: '예',
        cancelText: '아니오',
        color: 'primary',
    });
    if (!ok) return;
    auth.logout();
    router.push({ path: '/' });
}
</script>
<template>
    <v-system-bar v-if="!hideTopbar" app :class="['feature-topbar', topbarTone]">
        <span class="topbar-status">
            {{ isExpired ? '만료됨' : `인증 만료까지 ${hhmmssToExpiry}` }}
        </span>
        <v-btn v-if="isExpirySoonLocal || showRefresh" variant="plain" size="xs" prepend-icon="mdi-refresh" class="ml-2"
            :color="autoRefreshFailed ? 'error' : undefined" :loading="refreshing" @click="refresh"
            :text="`연장하기 ${isExpired ? `${hhmmssGraceLeft} 까지 연장 가능` : ''}`" />
        <v-btn v-if="showLogin && !showRefresh" variant="plain" prepend-icon="mdi-login-variant" size="xs" class="ml-2"
            @click="goLogin" text="로그인" />
        <v-btn v-else variant="plain" prepend-icon="mdi-logout-variant" size="xs" class="ml-2" text="로그아웃"
            @click="logout" />
    </v-system-bar>
</template>

<style scoped>
.feature-topbar {
    border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.16);
}
</style>
