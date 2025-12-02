<template>
<div v-if="visible" style="margin:0px;">
    <v-icon v-if="params.value" color="info" icon="mdi-checkbox-marked-circle"></v-icon>
    <v-icon v-else icon="mdi-window-close"></v-icon>
</div>
</template>
<script setup lang="ts">
import { computed, defineProps } from 'vue';
const props = defineProps<{ params: any }>();
const visible = computed(() => {
    if (props.params.data) {
        return true;
    }
    return false;
});

</script>
<style scoped></style>