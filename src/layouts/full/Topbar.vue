<script setup lang="ts">
import { useJwtCountdown } from '@/components/jwt/useJwtCountdown';
import { useConfirm } from '@/plugins/confirm';
import { useAuthStore } from '@/stores/studio/mgmt/auth.store';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
const items = [
    { text: 'Top Menu1', icon: 'mdi-wifi-strength-3', url: '/' },
    { text: 'Top Menu2', icon: 'mdi-signal-cellular-outline', url: '/' },
    { text: 'Top Menu3', icon: 'mdi-timer-sand', url: '/' }
];
const auth = useAuthStore();
const tokenRef = computed(() => auth.token);
const { exp, showRefresh, showLogin, isExpirySoon, hhmmssToExpiry, hhmmssGraceLeft, inGrace, statusText , isExpired} = useJwtCountdown( tokenRef , {
    // 없으면 생략 -> 내부 default 파서 사용
    graceSeconds:  1 * 60, // 5분
    tickMs: 1000,
    clockSkewSec: 3,
    preExpiryWindowSec: 60 * 10 , // 10분
});
const nowEpoch = ref(Math.floor(Date.now() / 1000));
let nowTimer: number | null = null;
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
});
const hideTopbar = computed(() => {
    if (!isExpired.value) return false;
    if (!exp.value) return false;
    return nowEpoch.value >= exp.value + 30 * 60;
});
const topbarTone = computed(() => {
    if (isExpired.value && inGrace.value) return 'topbar-tone--grace';
    if (isExpired.value && !inGrace.value) return 'topbar-tone--expired';
    if (isExpirySoon.value) return 'topbar-tone--soon';
    return 'topbar-tone--normal';
});
const confirm = useConfirm();
const refreshing = ref(false);
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
        <v-btn v-if="isExpirySoon" variant="plain" size="xs" prepend-icon="mdi-refresh" class="ml-2"
            :loading="refreshing" @click="refresh"
            :text="`연장하기 ${isExpired ? `${hhmmssGraceLeft} 까지 연장 가능` : ''}`" />
        <v-btn v-if="showLogin && !showRefresh" variant="plain" prepend-icon="mdi-login-variant" size="xs" class="ml-2"
            @click="goLogin" text="로그인" />
        <v-btn v-else variant="plain" prepend-icon="mdi-logout-variant" size="xs" class="ml-2" text="로그아웃"
            @click="logout" />
    </v-system-bar>
</template>
