<template>
  <RouterView></RouterView>
  <ToastHost />
  <ConfirmHost />
</template>

<script setup lang="ts">
import ToastHost from '@/components/toast/ToastHost.vue';
import ConfirmHost from '@/components/dialog/ConfirmHost.vue';
import { useMailSyncRealtimeStore } from '@/stores/studio/mgmt/mail.sync.realtime.store';
import { RouterView } from "vue-router";

const mailSyncRealtime = useMailSyncRealtimeStore();
if (!mailSyncRealtime.started) {
  mailSyncRealtime.start();
}

</script>
