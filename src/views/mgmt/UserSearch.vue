<template>
  <v-autocomplete v-model="select" v-model:search="search" :items="items" :loading="loading" class="pl-0"
    density="comfortable" clearable hide-details label="Enter a name, username or email" no-data-text="Not found."
    prepend-inner-icon="mdi-magnify" item-title="name" item-value="userId" return-object :custom-filter="() => true">
    <template v-slot:append>
      <v-btn prepend-icon="mdi-account-plus" variant="text" color="blue" @click="onAddClick"
        :disabled="!canAdd">Add</v-btn>
    </template>
    <template #item="{ props, item }">
      <v-list-item v-bind="props" :prepend-avatar="DEFAULT_AVATAR" :title="item?.raw?.name || item?.raw?.username"
        :subtitle="item?.raw?.email || item?.raw?.username" />
    </template>
  </v-autocomplete>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useFindUserDataSource } from '@/stores/studio/find.user.store'
import type { UserDto } from '@/stores/studio/users.store'
import DEFAULT_AVATAR from '@/assets/images/users/avatar-1.jpg';
// 상태
const select = ref<UserDto | null>(null)
const search = ref('')
const items = ref<UserDto[]>([])
const loading = ref(false)

const store = useFindUserDataSource()

/**  이벤트 정의
 *  - change: 전체 선택 목록이 바뀔 때
 *  - add:    방금 추가된 항목과 전체 목록
 */
const emit = defineEmits<{
  (e: 'change', list: UserDto[]): void
  (e: 'add', item: UserDto, list: UserDto[]): void
}>();

// 디바운스 
let timer: number | undefined
function debounce(fn: () => void, ms = 300) {
  if (timer) window.clearTimeout(timer)
  timer = window.setTimeout(fn, ms)
}

let lastQueryId = 0
async function findAll(keyword: string) {
  const queryId = ++lastQueryId
  loading.value = true
  try {
    store.setFilter({ q: keyword?.trim() })
    await store.fetch()
    if (queryId !== lastQueryId) return
    items.value = [...store.dataItems]
  } catch (e) {
    console.error(e)
    items.value = []
  } finally {
    if (queryId === lastQueryId) loading.value = false
  }
}

watch(search, (q) => {
  debounce(() => {
    if (q && q.trim().length >= 2) findAll(q)
    else items.value = []
  }, 300)
})

watch(select, (u) => {

})

const canAdd = computed(() =>
  !!select.value &&
  !selectedList.value.some(u => u.userId === select.value!.userId)
)

function onAddClick() {
  if (select.value != null) addToList(select.value)
}

function clearInput() {
  select.value = null
  search.value = ''
}

const selectedList = ref<UserDto[]>([])
function addToList(user: UserDto) {
  if (selectedList.value.some(u => u.userId === user.userId)) {
    clearInput()
    return
  }
  selectedList.value = [...selectedList.value, { ...user }]
  emit('add', user, selectedList.value)
  emit('change', selectedList.value)
  clearInput()
}
</script>