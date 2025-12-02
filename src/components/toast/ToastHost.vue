<!-- src/plugins/ToastHost.vue -->
<template>
  <teleport to="body">
    <v-snackbar
      v-model="s.show"
      :timeout="s.timeout"
      :color="s.color"
      :location="s.location"
      rounded="lg"
      elevation="12"
    >
      <div class="flex items-center gap-2">
        <v-icon v-if="s.icon" :icon="s.icon" size="18" />
        <span>{{ s.message }}</span>
      </div>
      <template #actions>
        <v-btn icon="mdi-close" variant="text" @click="s.show=false" />
      </template>
    </v-snackbar>
  </teleport>
</template>
<script setup lang="ts">
import { useToastState } from '@/plugins/toast';
const s = useToastState();
</script>
