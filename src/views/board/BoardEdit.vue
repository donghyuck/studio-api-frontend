<template>
  <v-container fluid class="fill-height pa-4" style="max-width: 1200px">
    <p class="text-h3">게시판</p>
    <v-card elevation="2" class="d-flex flex-column fill-height mt-10">
      <v-card-title class="text-h5 ml-2">게시글 작성</v-card-title>

      <v-card-text class="d-flex flex-column flex-grow-1 mt-4">
        <v-form
          @submit.prevent="submitForm"
          class="d-flex flex-column flex-grow-1"
        >
          <v-text-field
            v-model="form.title"
            label="제목"
            dense
            outlined
            required
          />
          <v-textarea
            v-model="form.content"
            label="내용"
            outlined
            required
            class="flex-grow-1"
            style="min-height: 300px"
          />
          <v-row justify="end" class="mt-4">
            <v-btn class="btn_bot" @click="cancel">취소</v-btn>
            <v-btn class="ml-2" type="submit" color="primary">등록</v-btn>
          </v-row>
        </v-form>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
  import { reactive, computed, onMounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { useBoardStore } from '@/stores/pem/board.store';
  import { useAuthStore } from '@/stores/pem/auth.store';

  const auth = useAuthStore();
  const user = auth.user as any;
  const route = useRoute();
  const boardId = Number(route.params.boardId);
  const isEditMode = computed(() => !!boardId);

  // 페이지 로드시 사용자 정보 가져오기
  onMounted(async () => {
    if (isEditMode.value) {
      const response = await boardStore.getBoardDetail(boardId);
      form.title = response.title;
      form.content = response.content;
    }
  });

  const router = useRouter();
  const boardStore = useBoardStore();

  const form = reactive({
    userId: 0,
    title: '',
    content: '',
  });

  const submitForm = async () => {
    if (!user?.userId) {
      alert('로그인 후 이용 가능합니다.');
      router.push('/auth/login');
      return;
    }

    const boardData = {
      title: form.title,
      content: form.content,
      userId: user.userId,
    };

    try {
      if (isEditMode.value) {
        await boardStore.updateBoard(boardId, boardData);
        alert('게시글이 수정되었습니다.');
      } else {
        await boardStore.createBoard(boardData);
        alert('게시글이 등록되었습니다.');
      }
      router.push({ name: 'BoardList', query: { refresh: 'true' } });
    } catch (error) {
      console.error('등록 실패', error);
      alert('오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  // 취소 버튼 클릭 시 목록 페이지로 이동
  const cancel = () => {
    router.push({ name: 'BoardList', query: { refresh: 'true' } });
  };
</script>

<style scoped></style>
