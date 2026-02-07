<!-- src/components/AuthImg.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useAuthImage } from './useAuthImage'
import { useAuthStore } from '@/stores/studio/mgmt/auth.store'
import { storeToRefs } from 'pinia'

interface Props {
    srcUrl?: string
    token?: string | undefined
    alt?: string
    cover?: boolean
    lazy?: boolean
    fallbackSrc?: string        // 실패 시 대체 이미지
    aspect?: number | string    // v-img props
    width?: string | number
    height?: string | number
}
const auth = useAuthStore()
const { token } = storeToRefs(auth)
const props = withDefaults(defineProps<Props>(), {
    cover: true,
    lazy: true,
    fallbackSrc: undefined,
})
const { src, loading, error } = useAuthImage(
    () => props.srcUrl,
    () => props.token || token.value ,
    { fallbackSrc: props.fallbackSrc, retries: 0, revokePrevious: true },
)
const ariaLabel = computed(() => props.alt || 'image')
</script>

<template>
    <v-img :src="src" :alt="ariaLabel" :cover="cover" :lazy-src="lazy ? fallbackSrc : undefined" :aspect-ratio="aspect"
        :width="width" :height="height">
        <template #placeholder>
            <div class="d-flex align-center justify-center fill-height">
                <v-progress-circular indeterminate v-if="loading" />
                <v-icon v-else>mdi-image</v-icon>
            </div>
        </template>

        <template #error>
            <div class="d-flex align-center justify-center fill-height">
                <v-icon color="error" class="mr-2">mdi-alert</v-icon>
                <span>이미지를 불러오지 못했어요</span>
            </div>
        </template>
    </v-img>
</template>
<style scoped>
.fill-height {
    height: 100%;
    width: 100%;
}
</style>
