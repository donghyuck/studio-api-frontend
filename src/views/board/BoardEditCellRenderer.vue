<template>
  <v-card variant="outlined" class="border-0 profile-cell">
    <v-card-item class="pa-0">
      <router-link :to="{ name: 'BoardDetail', params: { boardId } }">
        {{ title }}
      </router-link>
    </v-card-item>
  </v-card>
</template>
<script setup lang="ts">
  import { computed } from 'vue';
  const props = defineProps<{ params: any }>();
  const boardId = computed(() => props.params?.data?.boardId ?? 0);
  const title = computed(() => props.params?.data?.title ?? '');
</script>
