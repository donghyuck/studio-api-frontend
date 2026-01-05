<template>
  <teleport to="body">
    <v-dialog v-model="s.open" :persistent="s.persistent" max-width="420">
      <v-card>
        <v-card-title class="text-h6">{{ s.title }}</v-card-title>
        <v-card-text style="white-space:pre-line">{{ s.message }}</v-card-text>
        <v-card-actions class="justify-end">
          <v-btn variant="text" @click="resolve(false)">{{ s.cancelText }}</v-btn>
          <v-btn :color="s.color" variant="flat" @click="resolve(true)">{{ s.okText }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </teleport>
</template>
<script setup lang="ts">
import { useConfirmState, useConfirmResolve } from '@/plugins/confirm';
const s = useConfirmState();
const resolve = useConfirmResolve();
</script>
