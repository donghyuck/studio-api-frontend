<script setup lang="ts">
import { Icon } from '@iconify/vue';
import icon1 from '@/assets/images/technology/vue-cat-icon.svg';
import icon2 from '@/assets/images/technology/angular-cat-icon.svg';
import icon3 from '@/assets/images/technology/next-cat-icon.svg';
import icon4 from '@/assets/images/technology/react-cat-icon.svg';
import icon5 from '@/assets/images/technology/nuxt-cat-icon.svg';
import icon6 from '@/assets/images/technology/bt-cat-icon.svg';
const items = [
    { text: 'Top Menu1', icon: 'window-frame-linear', url: '/' },
    { text: 'Top Menu2', icon: 'question-circle-linear', url: '/' },
    { text: 'Top Menu3', icon: 'case-round-linear', url: '/' }
];
</script>
<template>
    <div class="feature-topbar w-full py-4 px-6 w-100">
        <div class="d-flex flex-lg-row flex-column gap-3 justify-space-between align-center">
            <div class="d-flex align-center ga-6">
                <a href="/" target="_blank" class="lh-0">
                    <img src="@/assets/images/logos/greentogether.gif" width="108"
                /></a>
                <div class="d-lg-flex d-none items-center ga-4 topbar-links border-s border-opacity-25 ps-6">
                    <a
                        v-for="(item, index) in items"
                        :key="index"
                        class="d-flex items-center p-0 ga-2 lh-normal"
                        variant="text"
                        :href="item.url"
                        target="_blank"
                    >
                        <Icon :icon="'solar:' + item.icon" height="20" width="20" />
                        {{ item.text }}
                    </a>
                </div>
            </div>
            <div class="d-flex flex-md-row flex-column align-center ga-4">
                <h5 class="text-subtitle-1 font-weight-bold text-linear-gradient text-uppercase">Top menu bar</h5>
                <div class="d-flex flex-md-row flex-wrap justify-md-end justify-center ga-3">
                </div>
            </div>
        </div>
    </div>
</template>
