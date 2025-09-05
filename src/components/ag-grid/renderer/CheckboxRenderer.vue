<template>
    <!-- <input type="checkbox" :checked="params.value" disabled /> -->
    <v-icon v-if="params.value" color="info" icon="mdi-checkbox-marked-circle"></v-icon>
    <v-icon v-else icon="mdi-window-close"></v-icon>
</template>
<script setup lang="ts">
import { defineProps } from 'vue';
const props = defineProps<{ params: any }>();
</script>
<style scoped></style>