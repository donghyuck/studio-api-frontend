<template>
    <div class="logo">
        <RouterLink to="/">
            <v-img :src="LOGO" max-width="300" cover height="100px" min-width="200"/>
        </RouterLink>
    </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import LOGO from "@/assets/images/logos/studio_one.jpg";

const primary = ref('rgb(var(--v-theme-primary))');
const secondary = ref('rgb(var(--v-theme-secondary))');

</script>
