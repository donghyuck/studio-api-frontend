<template>
  <v-list-item class="w-100" v-if="metadata">
    <template v-slot:prepend>
    </template>
    <v-list-item-title> 
      <v-chip variant="outlined" density="comfortable" size="small">
        {{ metadata?.contentType }}
      </v-chip>
      {{ metadata?.name }} </v-list-item-title> 
    <v-list-item-subtitle>
      {{ metadata?.objectType }} /   {{ metadata?.objectId }}, {{ metadata?.size }}</v-list-item-subtitle>
  </v-list-item>
</template>
<script setup lang="ts"> 
import { computed } from 'vue';
const props = defineProps<{ params: any }>();
const column = props.params.column;
const metadata = computed<Record<string, unknown> | null>(() => {
  return (props.params.value as Record<string, unknown> | null) ?? null;
});
</script>
