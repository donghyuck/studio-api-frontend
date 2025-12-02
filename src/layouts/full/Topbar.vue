<script setup lang="ts">
import { useJwtCountdown } from '@/components/jwt/useJwtCountdown';
import { useConfirm } from '@/plugins/confirm';
import { useAuthStore } from '@/stores/studio/auth.store';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
const items = [
    { text: 'Top Menu1', icon: 'mdi-wifi-strength-3', url: '/' },
    { text: 'Top Menu2', icon: 'mdi-signal-cellular-outline', url: '/' },
    { text: 'Top Menu3', icon: 'mdi-timer-sand', url: '/' }
];
const auth = useAuthStore();
const tokenRef = computed(() => auth.token);
const { showRefresh, showLogin, isExpirySoon, hhmmssToExpiry, hhmmssGraceLeft, inGrace, statusText , isExpired} = useJwtCountdown( tokenRef , {
    // 없으면 생략 -> 내부 default 파서 사용
    graceSeconds:  1 * 60, // 5분
    tickMs: 1000,
    clockSkewSec: 3,
    preExpiryWindowSec: 60 * 10 , // 10분
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
</script>
<template>
    <v-layout style="height: 24px">
        <v-system-bar :color="isExpirySoon ? 'red' : 'indigo-darken-2'">
            <spin variant="flat">
                {{ isExpired ? '만료됨' : `인증 만료까지 ${hhmmssToExpiry}` }}
            </spin>
            <v-btn v-if="isExpirySoon" plat variant="plain" size="xs" prepend-icon="mdi-refresh" class="ml-2" :loading="refreshing"
                @click="refresh">
                연장하기 {{ isExpired ? `${hhmmssGraceLeft} 까지 연장 가능`  : ''}}
            </v-btn>
            <v-btn v-if="showLogin && !showRefresh" variant="plain" prepend-icon="mdi-login-variant" size="xs" class="ml-2" @click="goLogin">로그인</v-btn>
            <v-btn v-else variant="plain" prepend-icon="mdi-logout-variant" size="xs" class="ml-2" >로그아웃</v-btn>
        </v-system-bar>
    </v-layout>
</template>
