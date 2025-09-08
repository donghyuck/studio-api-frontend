<template>
  <v-container fluid class="fill-height pa-4" style="max-width: 1200px">
    <p class="text-h3">게시판</p>
    <v-card elevation="2" class="d-flex flex-column fill-height mt-10">
      <v-card-title class="text-h5 ml-2">게시글 상세</v-card-title>

      <v-card-text class="d-flex flex-column flex-grow-1">
        <v-skeleton-loader
          v-if="loading"
          type="heading, paragraph"
          class="mt-4"
        />

        <template v-else>
          <v-text-field
            label="제목"
            :model-value="board.title"
            readonly
            outlined
          />

          <v-textarea
            label="내용"
            :model-value="board.content"
            readonly
            outlined
            class="flex-grow-1"
            style="min-height: 300px"
          />

          <div class="text-caption text-grey-darken-1">
            <div>작성일: {{ formatDate(board.creationDate) }}</div>
            <div>수정일: {{ formatDate(board.modifiedDate) }}</div>
          </div>

          <v-row class="mt-4" justify="space-between" align-items="center">
            <v-col cols="auto">
              <v-btn
                v-if="user?.userId === board.userId"
                color="error"
                @click="deleteBoard"
                >삭제</v-btn
              >
            </v-col>

            <v-col cols="auto" class="d-flex">
              <v-btn class="ml-2" @click="goBoardList">목록</v-btn>
              <v-btn
                v-if="user?.userId === board.userId"
                class="ml-2"
                color="primary"
                @click="editBoard"
                >수정하기</v-btn
              >
            </v-col>
          </v-row>
        </template>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
  import { onMounted, ref, reactive } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { useBoardStore } from '@/stores/studio/board.store';
  import { useAuthStore } from '@/stores/studio/auth.store';

  interface Board {
    boardId: number;
    userId: number;
    title: string;
    content: string;
    creationDate: string;
    modifiedDate: string;
  }

  const board = reactive<Board>({
    boardId: 0,
    userId: 0,
    title: '',
    content: '',
    creationDate: '',
    modifiedDate: '',
  });

  const auth = useAuthStore();
  const loading = ref(true);
  const route = useRoute();
  const router = useRouter();
  const boardStore = useBoardStore();
  const boardId = Number(route.params.boardId);
  const user = auth.user as any;

  const fetchBoard = async () => {
    try {
      const response = await boardStore.getBoardDetail(boardId);
      board.boardId = response.boardId;
      board.userId = response.userId;
      board.title = response.title;
      board.content = response.content;
      board.creationDate = response.creationDate;
      board.modifiedDate = response.modifiedDate;
    } catch (error) {
      console.error('게시글 상세보기', error);
    } finally {
      loading.value = false;
    }
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString();
  };
  const goBoardList = () => {
    router.push({ name: 'BoardList' });
  };
  const editBoard = () => {
    router.push({ name: 'BoardEdit', params: { boardId } });
  };
  const deleteBoard = async () => {
    if (!boardId) {
      alert('삭제할 게시글이 존재하지 않습니다.');
      return;
    }

    if (confirm('정말로 삭제하시겠습니까?')) {
      try {
        await boardStore.deleteBoard(boardId, {
          userId: user?.userId,
        });
        alert('게시글이 삭제되었습니다.');
        router.push({ name: 'BoardList', query: { refresh: 'true' } });
      } catch (error) {
        console.error('삭제 실패', error);
      }
    }
  };

  onMounted(async () => {
    fetchBoard();
  });
</script>

<style scoped></style>
