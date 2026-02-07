<template>
  <v-breadcrumbs class="pa-0" :items="['커뮤니티', '게시판']" density="compact" />
  <PageToolbar title="게시판" label="커뮤니티 게시판 목록입니다." @refresh="refresh" :closeable="false" :divider="true"
    :items="[{ icon: 'mdi-refresh', event: 'refresh', tooltip: '새로고침' }]" />
  <v-card density="compact" class="mt-1" variant="text">
    <v-card-actions class="pa-0">
      <v-container fluid class="pa-0">
        <v-row>
          <v-col>
            <v-text-field v-model="q" label="검색어" placeholder="게시판 이름/슬러그를 입력하세요." @keydown.enter="onSearchClick"
              hide-details variant="outlined" density="compact">
              <template v-slot:append>
                <v-btn icon="mdi-text-search" variant="tonal" @click="onSearchClick" />
              </template>
            </v-text-field>
          </v-col>
        </v-row>
      </v-container>
    </v-card-actions>
    <v-list density="comfortable">
      <template v-if="loading">
        <v-list-item v-for="index in skeletonCount" :key="`forum-skeleton-${index}`" class="discourse-row">
          <v-list-item-title class="text-body-1 font-weight-medium">
            <v-skeleton-loader type="text" width="40%" />
          </v-list-item-title>
          <v-list-item-subtitle class="text-caption">
            <v-skeleton-loader type="text" width="25%" />
          </v-list-item-subtitle>
          <template #append>
            <v-skeleton-loader type="text" width="140" />
          </template>
        </v-list-item>
      </template>
      <template v-else>
        <v-list-item v-for="forum in forums" :key="forum.slug" @click="goForum(forum.slug)" class="discourse-row">
          <v-list-item-title class="text-body-1 font-weight-medium">
            {{ forum.name }}
            <span v-if="forum.viewType" class="text-caption text-grey-darken-1 ml-2">
              {{ viewTypeLabel(forum.viewType) }}
            </span>
          </v-list-item-title>
          <v-list-item-subtitle class="text-caption">
            {{ forum.slug }}
          </v-list-item-subtitle>
          <template #append>
            <div class="text-caption text-grey-darken-1">
              {{ dayjs(forum.updatedAt).format("YYYY-MM-DD HH:mm:ss") }}
            </div>
          </template>
        </v-list-item>
        <v-list-item v-if="forums.length === 0">
          <v-list-item-title class="text-body-2 text-grey-darken-1">
            게시판이 없습니다.
          </v-list-item-title>
        </v-list-item>
      </template>
    </v-list>
    <v-divider />
    <v-card-actions class="justify-end">
      <v-pagination v-if="totalPages > 1" v-model="pageUi" :length="totalPages" density="compact"
        :disabled="loading" />
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import PageToolbar from '@/components/bars/PageToolbar.vue';
import { usePublicForumListStore } from '@/stores/studio/public/forum.list.store';
import dayjs from 'dayjs';
import { computed, onMounted, ref, unref, watch } from 'vue';
import { useRouter } from 'vue-router';

const dataStore = usePublicForumListStore();
const router = useRouter();

const q = ref<string | null>(null);
const inFields = "name,description";
const pageUi = ref(1);
const loading = computed(() => unref(dataStore.loading));
const skeletonCount = computed(() => Math.min(8, Math.max(3, unref(dataStore.pageSize) ?? 20)));

function onSearchClick() {
  const params: Record<string, any> = {};
  const trimmedQ = q.value?.trim();
  const trimmedIn = inFields;
  if (trimmedQ) params.q = trimmedQ;
  if (trimmedIn) params.in = trimmedIn;
  dataStore.setFilter(params);
  dataStore.setPage(0);
  fetchForums();
}

const forums = computed(() => unref(dataStore.dataItems) ?? []);
const total = computed(() => unref(dataStore.total) ?? 0);
const totalPages = computed(() => {
  const size = unref(dataStore.pageSize) || 20;
  return Math.max(1, Math.ceil(total.value / size));
});

const fetchForums = async () => {
  await dataStore.fetch();
};

const viewTypeLabelMap: Record<string, string> = {
  GENERAL: '일반형',
  GALLERY: '갤러리형',
  VIDEO: '동영상형',
  LIBRARY: '자료실형',
  NOTICE: '공지형',
};

const viewTypeLabel = (value?: string) => {
  if (!value) return '';
  return viewTypeLabelMap[value] ?? value;
};

const refresh = () => {
  fetchForums();
};

const goForum = (slug: string) => {
  if (!slug) return;
  router.push({ name: 'CommunityForumTopics', params: { forumSlug: slug } });
};

watch(pageUi, async (val) => {
  const nextPage = Math.max(0, val - 1);
  dataStore.setPage(nextPage);
  await fetchForums();
});

onMounted(() => {
  pageUi.value = (dataStore.page ?? 0) + 1;
  fetchForums();
});
</script>

<style scoped>
.discourse-list {
  background: #fff;
}

.discourse-row {
  border-bottom: 1px solid #f0f0f0;
}

.discourse-row:last-child {
  border-bottom: 0;
}
</style>
