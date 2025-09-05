<template>
  <v-list-item>
    <v-list-item-title class="text-body-1">
      {{ name }}
      <v-list-item-subtitle class="text-left text-body-2">{{ displayName ? displayName : title }}</v-list-item-subtitle>
    </v-list-item-title>
    <template v-slot:append v-if="editable">
      <v-btn
        size="x-small"
        color="secondary"
        prepend-icon="mdi-file-edit"
        variant="tonal"
        class="ml-1" @click="edit">
        Edit
      </v-btn>
    </template>
  </v-list-item>
</template>
<script setup lang="ts">
import { computed } from "vue";   
 

const props = defineProps<{ params: any }>();
const column = props.params.column;

const editable = computed(() => {
    return true;
});

const displayName = computed(() => {
  if (props.params.data && props.params.data.displayName) {
    return props.params.data.displayName;
  }
  return "";
});

const title = computed(() => {
  if (props.params.data && props.params.data.title) {
    return props.params.data.title;
  }
  return "";
});

const name = computed(() => {
  if (props.params.data && props.params.data.name) {
    return props.params.data.name;
  }
  return "";
});

const emits = defineEmits(['edit']);
const edit = () => {
    props.params.api.dispatchEvent({
            type: 'nameCellRenderer:edit',
            data: props.params.data
    });
};
</script>
