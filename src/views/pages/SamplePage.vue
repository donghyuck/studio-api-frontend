<script setup lang="ts"></script>
<template>
  <v-row>
    <!-- <v-col cols="12" md="12">
      <UiParentCard title="Sample Page">
        <div class="pa-7 pt-1">
          <p class="text-body-1">This is a sample page</p>
          <p class="text-body-1 mt-3">
            사용자: <strong>{{ user || '알 수 없음' }}</strong> 아이디:
            <strong>{{ user?.userId || '알 수 없음' }}</strong> 이름 :
            <strong>{{ user?.name || '알 수 없음' }}</strong>
          </p>
        </div>
      </UiParentCard>
    </v-col> -->
    <v-col>
      <BoardList></BoardList>
    </v-col>
  </v-row>
</template>
<script setup lang="ts">
  import UiParentCard from '@/components/shared/UiParentCard.vue';
  import BoardList from '@/views/board/BoardList.vue';
  import type { ColDef } from 'ag-grid-community';
  import { ref, onMounted } from 'vue';
  import api from '@/plugins/axios'; // API 호출을 위한 axios 인스턴스

  const user = ref(null);

  // 사용자 정보 가져오는 함수
  const fetchUser = async () => {
    try {
      const response = await api.get('/api/account/me');
      user.value = response.data.data; // { success, data: {...} } 구조일 경우
    } catch (e) {
      console.error('사용자 정보 가져오기 실패', e);
    }
  };

  // 페이지 로드시 사용자 정보 가져오기
  onMounted(() => {
    fetchUser();
  });
</script>
