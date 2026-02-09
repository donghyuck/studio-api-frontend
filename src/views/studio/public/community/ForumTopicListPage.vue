<template>
  <v-breadcrumbs class="pa-0" :items="['커뮤니티', forum?.name || forumSlug]" density="compact" />
  <PageToolbar
    :title="forum?.name || '게시글 목록'"
    @refresh="refresh"
    @create="handleCreateClick"
    :closeable="false"
    :divider="true"
    :previous="true"
    :previous-to="{ name: 'CommunityForums' }"
    :previous-title="'게시판 목록'"
    :items="toolbarItems"
  >
    <template #label>
      <span>{{ forum?.name ? `${forum.name} 게시판` : '게시판의 게시글을 확인합니다.' }}</span>
      <span v-if="lastUpdatedText" class="text-primary ml-2">{{ lastUpdatedText }}</span>
    </template>
  </PageToolbar>
  <v-card density="compact" class="mt-1" variant="text">
    <v-card-actions class="pa-0"> 
      <v-container fluid class="pa-0">
        <v-row>
          <v-col cols="3" v-if="canModerateTopics">
            <v-switch v-model="includeHiddenTopics" label="숨김 토픽 포함" density="compact" hide-details inset color="primary"/>
          </v-col>
          <v-col>
            <v-text-field v-model="q" label="검색어" placeholder="게시글 제목을 입력하세요." @keydown.enter="onSearchClick"
              hide-details variant="outlined" density="compact">
              <template v-slot:append>
                <v-btn icon="mdi-text-search" variant="tonal" @click="onSearchClick" />
              </template>
            </v-text-field>
          </v-col>
        </v-row>
      </v-container>
    </v-card-actions>
  </v-card>
  <PageableGridContent ref="pageableGridContentRef" :datasource="dataStore" :columns="columnDefs"
    :options="gridOptions" />
  <v-dialog v-model="dialogs.create" max-width="720">
    <v-card>
      <v-card-title class="text-subtitle-1">새 글 작성</v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12" md="4" v-if="hasCategories">
            <v-select v-model="categoryId" :items="categoryOptions" label="카테고리" density="compact" variant="outlined"
              :disabled="saving" />
          </v-col>
          <v-col cols="12" :md="forumTitleMd">
            <v-text-field v-model="title" label="제목" density="compact" variant="outlined" :disabled="saving" />
          </v-col>
          <v-col cols="12">
            <div class="text-caption text-grey-darken-1 mb-1">내용</div>
            <div class="tiptap-shell">
              <div class="tiptap-toolbar">
                <v-btn size="small" variant="tonal" :color="editor?.isActive('bold') ? 'primary' : 'grey'"
                  icon="mdi-format-bold" @click="editor?.chain().focus().toggleBold().run()" />
                <v-btn size="small" variant="tonal" :color="editor?.isActive('italic') ? 'primary' : 'grey'"
                  icon="mdi-format-italic" @click="editor?.chain().focus().toggleItalic().run()" />
                <v-btn size="small" variant="tonal" :color="editor?.isActive('strike') ? 'primary' : 'grey'"
                  icon="mdi-format-strikethrough" @click="editor?.chain().focus().toggleStrike().run()" />
                <v-divider vertical class="mx-2" />
                <v-btn size="small" variant="tonal" :color="editor?.isActive('bulletList') ? 'primary' : 'grey'"
                  icon="mdi-format-list-bulleted" @click="editor?.chain().focus().toggleBulletList().run()" />
                <v-btn size="small" variant="tonal" :color="editor?.isActive('orderedList') ? 'primary' : 'grey'"
                  icon="mdi-format-list-numbered" @click="editor?.chain().focus().toggleOrderedList().run()" />
                <v-divider vertical class="mx-2" />
                <v-btn size="small" variant="tonal" :color="editor?.isActive('blockquote') ? 'primary' : 'grey'"
                  icon="mdi-format-quote-close" @click="editor?.chain().focus().toggleBlockquote().run()" />
                <v-btn size="small" variant="tonal" :color="editor?.isActive('codeBlock') ? 'primary' : 'grey'"
                  icon="mdi-code-tags" @click="editor?.chain().focus().toggleCodeBlock().run()" />
                <v-divider vertical class="mx-2" />
                <v-btn size="small" variant="tonal" color="grey" icon="mdi-image-plus" @click="insertImageUrl" />
                <v-btn size="small" variant="tonal" color="grey" icon="mdi-video" @click="insertVideoUrl" />
                <v-btn size="small" variant="tonal" color="grey" icon="mdi-file-video" @click="insertMp4Url" />
              </div>
              <EditorContent :editor="editor" />
            </div>
          </v-col>
          <v-col cols="12">
            <v-text-field v-model="tags" label="태그 (쉼표로 구분)" density="compact" variant="outlined" :disabled="saving" />
          </v-col>
          <v-col cols="12" v-if="canUploadAttachments">
            <v-file-input v-model="topicAttachmentFiles" multiple density="compact" hide-details label="첨부파일 (선택)"
              prepend-icon="mdi-paperclip" :disabled="topicAttachmentUploading" truncate-length="24"
              @update:model-value="handleTopicAttachmentChange" />
          </v-col>
          <v-col cols="12" v-if="topicAttachmentError">
            <v-alert density="compact" variant="tonal" type="error" class="mb-0">
              {{ topicAttachmentError }}
            </v-alert>
          </v-col>
        </v-row>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="tonal" color="grey" @click="closeCreateDialog" :disabled="saving">
          취소
        </v-btn>
        <v-btn variant="outlined" color="primary" @click="submitCreate" :loading="saving" :disabled="!canCreate">
          등록
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import PageableGridContent from '@/components/ag-grid/PageableGridContent.vue';
import RemotePublicUserCellRenderer from '@/components/ag-grid/renderer/RemotePublicUserCellRenderer.vue';
import PageToolbar from '@/components/bars/PageToolbar.vue';
import { forumsAdminApi } from '@/data/studio/mgmt/forums';
import { forumsPublicApi } from '@/data/studio/public/forums';
import { useToast } from '@/plugins/toast';
import { useAuthStore } from '@/stores/studio/mgmt/auth.store';
import { usePublicForumAuthzStore } from '@/stores/studio/public/forum.authz.store';
import { usePublicForumListStore } from '@/stores/studio/public/forum.list.store';
import { usePublicForumTopicsStore } from '@/stores/studio/public/forum.topics.store';
import type { ForumResponse, PermissionAction } from '@/types/studio/forums';
import { resolveAxiosError } from '@/utils/helpers';
import { Node } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Youtube from '@tiptap/extension-youtube';
import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor } from '@tiptap/vue-3';
import type { ColDef, GridOptions } from 'ag-grid-community';
import dayjs from 'dayjs';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const forumListStore = usePublicForumListStore();
const dataStore = usePublicForumTopicsStore();
const auth = useAuthStore();
const forumSlug = computed(() => String(route.params.forumSlug || ""));
const forum = ref<ForumResponse | null>(null);
const authzStore = usePublicForumAuthzStore();

const VideoNode = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      controls: { default: true },
    };
  },
  parseHTML() {
    return [{ tag: 'video' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['video', { ...HTMLAttributes, controls: HTMLAttributes.controls ?? true }];
  },
});

const columnDefs: ColDef[] = [
  {
    field: 'title',
    headerName: '제목',
    filter: false,
    sortable: true,
    type: 'hyperlinks',
    flex: 3,
    cellRendererParams: {
      mode: 'router',
      to: (d: any) => ({
        name: 'CommunityForumTopicDetail',
        params: { forumSlug: forumSlug.value, topicId: d.id },
      }),
      router: router,
    },
  },
  { field: 'status', headerName: '상태', filter: false, sortable: true, maxWidth: 100, },
  {
    field: 'postCount',
    headerName: '댓글 수',
    filter: false,
    sortable: true,
    type: 'number',
    maxWidth: 100,
    valueGetter: (params) => {
      const count = Number(params.data?.postCount ?? 0);
      return Math.max(0, count - 1);
    },
  },
  { field: 'updatedAt', headerName: '수정일시', filter: false, type: 'datetime', flex: 1 },
  {
    field: 'lastPostUpdatedById',
    headerName: '최종 수정자',
    filter: false,
    sortable: false,
    flex: 1,
    width: 150,
    cellRenderer: RemotePublicUserCellRenderer,
  },
  { field: 'lastActivityAt', headerName: '최근 활동', filter: false, type: 'datetime', flex: 1 },
];

const gridOptions: GridOptions = {
  rowSelection: { mode: 'singleRow', enableClickSelection: true, checkboxes: false },
  rowMultiSelectWithClick: false,
};

const pageableGridContentRef = ref<InstanceType<typeof PageableGridContent> | null>(null);
const includeHiddenTopics = ref(false);
const hasForumPermission = (action: PermissionAction) =>
  authzStore.hasPermission(forumSlug.value, action);
const canCreateTopic = computed(() => hasForumPermission("CREATE_TOPIC"));
const canUploadAttachments = computed(() => hasForumPermission("UPLOAD_ATTACHMENT"));
const canModerateTopics = computed(() => hasForumPermission("MODERATE"));
const q = ref<string | null>(null);
const inFields = "title";
const dialogs = ref({ create: false });
const buildTopicFilterParams = () => {
  const params: Record<string, any> = { in: inFields };
  const trimmedQ = q.value?.trim();
  if (trimmedQ) {
    params.q = trimmedQ;
  }
  if (includeHiddenTopics.value) {
    params.includeHidden = true;
  }
  return params;
};

const applyTopicFilters = () => {
  dataStore.setFilter(buildTopicFilterParams());
};
applyTopicFilters();
const categories = ref<Array<{ id: number; name: string }>>([]);
const categoryId = ref<number | null>(null);
const title = ref('');
const editor = useEditor({
  extensions: [
    StarterKit,
    Placeholder.configure({
      placeholder: '내용을 입력하세요.',
    }),
    Image.configure({
      inline: false,
    }),
    Youtube.configure({
      controls: true,
      modestBranding: true,
    }),
    VideoNode,
  ],
  content: '',
});
const tags = ref('');
const saving = ref(false);
const topicAttachmentFiles = ref<File[]>([]);
const topicAttachmentError = ref<string | null>(null);
const topicAttachmentUploading = ref(false);

const categoryOptions = computed(() =>
  categories.value.map((c) => ({ title: c.name, value: c.id }))
);
const hasCategories = computed(() => categoryOptions.value.length > 0);
const forumTitleMd = computed(() => hasCategories.value ? 8 : 12);
const toolbarItems = computed(() => {
  const items: { icon: string; event: string; tooltip: string }[] = [];
  if (canCreateTopic.value) {
    items.push({ icon: 'mdi-pencil', event: 'create', tooltip: '글쓰기' });
  }
  items.push({ icon: 'mdi-refresh', event: 'refresh', tooltip: '새로고침' });
  return items;
});


const hasEditorContent = computed(() => {
  const text = editor.value?.getText()?.trim() ?? '';
  if (text.length > 0) return true;
  const html = editor.value?.getHTML() ?? '';
  return /<(img|iframe|video)\b/i.test(html);
});

const canCreate = computed(() => {
  const hasRequiredCategory = !hasCategories.value || !!categoryId.value;
  return (
    canCreateTopic.value &&
    !saving.value &&
    hasRequiredCategory &&
    title.value.trim().length > 0 &&
    hasEditorContent.value
  );
});

const insertImageUrl = () => {
  const url = window.prompt('이미지 URL을 입력하세요.');
  if (!url) return;
  editor.value?.chain().focus().setImage({ src: url.trim() }).run();
};

const insertVideoUrl = () => {
  const url = window.prompt('동영상 URL을 입력하세요. (YouTube 지원)');
  if (!url) return;
  editor.value?.chain().focus().setYoutubeVideo({ src: url.trim() }).run();
};

const insertMp4Url = () => {
  const url = window.prompt('MP4 URL을 입력하세요.');
  if (!url) return;
  const safeUrl = url.trim();
  editor.value?.chain().focus().insertContent({ type: 'video', attrs: { src: safeUrl, controls: true } }).run();
};

const handleTopicAttachmentChange = (files: File | File[] | null) => {
  const next = Array.isArray(files) ? files.slice(0, files.length) : files ? [files] : [];
  topicAttachmentFiles.value = next.filter((file): file is File => file instanceof File);
  topicAttachmentError.value = null;
};

const uploadTopicAttachments = async (slug: string, topicId: number, postId: number) => {
  if (!topicAttachmentFiles.value.length) return;
  if (!canUploadAttachments.value) return;
  topicAttachmentUploading.value = true;
  try {
    for (const file of topicAttachmentFiles.value) {
      await forumsPublicApi.uploadPostAttachment(slug, topicId, postId, file);
    }
    topicAttachmentFiles.value = [];
    topicAttachmentError.value = null;
  } catch (error: any) {
    topicAttachmentError.value = resolveAxiosError(error);
    throw error;
  } finally {
    topicAttachmentUploading.value = false;
  }
};

const lastUpdatedText = computed(() => {
  const updatedAt = forum.value?.updatedAt;
  if (!updatedAt) return '';
  return `최종 업데이트 ${dayjs(updatedAt).format('YYYY-MM-DD HH:mm')}`;
});

function onSearchClick() {
  applyTopicFilters();
  dataStore.setPage(0);
  refresh();
}

const refresh = () => {
  pageableGridContentRef.value?.refresh();
};

watch(includeHiddenTopics, () => {
  applyTopicFilters();
  dataStore.setPage(0);
  refresh();
});

const loadCategories = async () => {
  const slug = forumSlug.value;
  if (!slug) return;
  try {
    const list = await forumsPublicApi.listCategories(slug);
    categories.value = list.map((c) => ({ id: c.id, name: c.name }));
  } catch {
    categories.value = [];
  }
};

const loadForumAuthz = async (slug: string) => {
  if (!slug) return;
  await authzStore.loadForumAuthz(slug).catch(() => {});
};

const loadForum = async () => {
  const slug = forumSlug.value;
  if (!slug) return;
  try {
    const fetchedForum = (await forumListStore.read?.(slug)) as ForumResponse | undefined;
    forum.value = fetchedForum ?? null;
  } catch {
    forum.value = null;
  }
};

const openCreateDialog = async () => {
  dialogs.value.create = true;
  await loadCategories();
  if (!hasCategories.value) {
    categoryId.value = null;
  }
};

const handleCreateClick = () => {
  if (!canCreateTopic.value) {
    toast.error("글쓰기 권한이 없습니다.");
    return;
  }
  openCreateDialog();
};

const closeCreateDialog = (force = false) => {
  if (saving.value && !force) return;
  dialogs.value.create = false;
  categoryId.value = null;
  title.value = '';
  editor.value?.commands.setContent('');
  tags.value = '';
  topicAttachmentFiles.value = [];
  topicAttachmentError.value = null;
  topicAttachmentUploading.value = false;
};

const submitCreate = async () => {
  if (!canCreate.value) return;
  const slug = forumSlug.value;
  const selectedCategoryId = categoryId.value ?? 0;
  if (!slug) return;
  saving.value = true;
  try {
    const contentHtml = editor.value?.getHTML()?.trim() ?? '';
    const payload = {
      title: title.value.trim(),
      tags: tags.value
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
    };
    const res = hasCategories.value
      ? await forumsAdminApi.createTopic(slug, selectedCategoryId, payload)
      : await forumsAdminApi.createTopicWithoutCategory(slug, payload);
    const topicId = (res as any)?.topicId as number | undefined;
    if (topicId) {
      const postRes = await forumsAdminApi.createPost(slug, topicId, { content: contentHtml });
      const postId = Number((postRes as any)?.postId ?? 0);
      if (postId && topicAttachmentFiles.value.length > 0 && canUploadAttachments.value) {
        try {
          await uploadTopicAttachments(slug, topicId, postId);
        } catch {
          toast.error('첨부파일 업로드에 실패했습니다.');
        }
      }
    }
    toast.success('게시글이 등록되었습니다.');
    closeCreateDialog(true);
    refresh();
  } catch {
    toast.error('게시글 등록에 실패했습니다.');
  } finally {
    saving.value = false;
  }
};

watch(
  () => forumSlug.value,
  async (slug) => {
    if (!slug) return;
    dataStore.setForumSlug(slug);
    await loadForum();
    await loadForumAuthz(slug);
  },
  { immediate: true }
);

</script>

<style scoped>
.tiptap-shell {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 10px 12px;
  background: #fff;
  min-height: 160px;
}

.tiptap-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e0e0e0;
  margin-bottom: 8px;
}

.tiptap-shell :deep(.ProseMirror) {
  outline: none;
  min-height: 140px;
}

.tiptap-shell :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: #9e9e9e;
  pointer-events: none;
  height: 0;
}

.tiptap-shell :deep(img) {
  max-width: 100%;
  height: auto;
  display: block;
}

.tiptap-shell :deep(iframe) {
  max-width: 100%;
  width: 100%;
  aspect-ratio: 16 / 9;
  height: auto;
  display: block;
}

.tiptap-shell :deep(video) {
  max-width: 100%;
  width: 100%;
  height: auto;
  display: block;
}
</style>
