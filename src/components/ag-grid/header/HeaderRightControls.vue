<template>sss
  <div class="hdr-right">
    <input type="checkbox" :checked="checked" @change="toggle" title="필터된 전체 선택/해제" />
    <span>{{ params.displayName }}</span>
  </div>
</template>
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
const props = defineProps<{ params: any }>()
const checked = ref(false)
function recompute() {
  const api = props.params.api
  let total = 0, selected = 0
  api.forEachNodeAfterFilterAndSort((n: any) => { total++; if (n.isSelected()) selected++ })
  checked.value = total > 0 && selected === total
}

function toggle(e: Event) {
  const api = props.params.api
  const on = (e.target as HTMLInputElement).checked
  api.forEachNodeAfterFilterAndSort((n: any) => n.setSelected(on))
  recompute()
}

onMounted(() => {
  const api = props.params.api
  api.addEventListener('modelUpdated', recompute)
  api.addEventListener('selectionChanged', recompute)
  api.addEventListener('filterChanged', recompute)
  recompute()
})
onBeforeUnmount(() => {
  const api = props.params.api
  api.removeEventListener('modelUpdated', recompute)
  api.removeEventListener('selectionChanged', recompute)
  api.removeEventListener('filterChanged', recompute)
})
</script>

<style scoped>
.hdr-right { display: inline-flex; align-items: center; padding-right: 4px; }
</style>
