<template>
  <v-container :fluid="true">
    <p class="text-h3">게시판</p>
    <v-row justify="end" class="pd-margin0">
      <v-col cols="auto pd-flex- btnBox-wrap">
        <v-btn
          color="primary"
          class="text-caption btn_top"
          @click="goCreateBoard"
          >게시글 등록</v-btn
        >
      </v-col>
    </v-row>
    <v-row no-gutters class="pd-mt0 mt-5">
      <v-col class="pd-flex- grid-search-area conts-search-area">
        <v-form ref="form" @submit.prevent="search">
          <v-row no-gutters class="pd-flex- pd-flex-line pd-gap15">
            <v-col cols="8" class="right">
              <v-text-field
                v-model="searchData.title"
                placeholder="제목을 검색하세요."
                dense
                outlined
                class="text-caption"
                variant="outlined"
                hide-details
              ></v-text-field>
            </v-col>
            <v-col>
              <v-btn class="btn-default btn-point ml-4 mt-2" type="submit"
                >검색</v-btn
              >
            </v-col>
          </v-row>
        </v-form>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <PageableGridContent
          @filter-actived="onPageableGridFilterActived"
          ref="pageableGridContentRef"
          :datasource="dataStore"
          :columns="columnDefs"
        >
        </PageableGridContent>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted } from 'vue';
  import { useRouter, useRoute } from 'vue-router';
  import { useBoardStore } from '@/stores/studio/board.store';
  import PageableGridContent from '@/components/ag-grid/PageableGridContent.vue';
  import type { ColDef } from 'ag-grid-community';
  import BoardEditCellRenderer from './BoardEditCellRenderer.vue';
  import type { ICellRendererParams } from 'ag-grid-community';

  const router = useRouter();
  const route = useRoute();
  const dataStore = useBoardStore();

  // 페이지 로드시 사용자 정보 가져오기
  onMounted(() => {
    if (route.query.refresh === 'true') {
      searchData.title = ''; // 필터 초기화
      search();
    }
  });

  // 검색 기능
  const searchData = reactive({
    title: '',
  });

  const search = async () => {
    dataStore.setFilter(searchData);
    pageableGridContentRef.value?.refresh();
  };

  // 게시글 등록 페이지로 이동
  const goCreateBoard = () => {
    console.log('게시글 등록 페이지로 이동');
    router.push({ name: 'BoardEdit' });
  };

  const pageableGridContentRef = ref<InstanceType<
    typeof PageableGridContent
  > | null>(null);
  const filtersActive = ref(false);
  function onPageableGridFilterActived(event: any) {
    filtersActive.value = event;
  }

  const columnDefs: ColDef[] = [
    {
      field: 'title',
      headerName: '제목',
      type: 'string',
      flex: 7,
      filter: false,
      cellRenderer: BoardEditCellRenderer,
      cellRendererParams: (params: ICellRendererParams<any, any>) => {
        return {
          target: 'boardId',
        };
      },
      cellStyle: { textAlign: 'left', display: 'flex', alignItems: 'center' },
      headerClass: 'text-center',
    },
    {
      field: 'name',
      headerName: '작성자',
      type: 'string',
      flex: 2,
      filter: false,
    },
    {
      field: 'creationDate',
      headerName: '작성일시',
      type: 'datetime',
      flex: 3,
      filter: false,
      headerClass: 'text-center',
    },
    {
      field: 'modifiedDate',
      headerName: '수정일시',
      type: 'datetime',
      flex: 3,
      filter: false,
    },
  ];
</script>

<style scoped></style>
