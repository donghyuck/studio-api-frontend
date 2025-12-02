<template>
  <RouterView></RouterView>
  <ToastHost />
  <ConfirmHost />
</template>

<script setup lang="ts">
import ToastHost from '@/components/toast/ToastHost.vue';
import ConfirmHost from '@/components/dialog/ConfirmHost.vue';
import { RouterView } from "vue-router";
</script>