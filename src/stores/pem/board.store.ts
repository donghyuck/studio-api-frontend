import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { PageableDataSource } from '@/types/ag-gird';
import { AbstractPageDataSource } from '@/stores/AbstractPageDataSource';
import api from '@/plugins/axios';

// IPageableBoardDataSource 정의
type IPageableBoardDataSource = PageableDataSource & {};
const fetchUrl = `/api/boards`;
class PageableBoardDataSource
  extends AbstractPageDataSource
  implements IPageableBoardDataSource
{
  // API 엔드포인트 URL을 제공
  getFetchUrl(): string {
    return fetchUrl;
  }
}

export const useBoardStore = defineStore('board-store', () => {
  // Pageable
  const dataSource = new PageableBoardDataSource();

  // STATE
  const objectType = ref(0);
  const objectId = ref(0);
  const isLoaded = ref<Boolean>(false);

  // 객체 ID 초기화
  function init(id: number = 0): void {
    if (objectId.value !== id) {
      objectId.value = id;
      isLoaded.value = false;
    }
  }

  // 게시글 상세 조회
  async function getBoardDetail(boardId: number) {
    try {
      const response = await api.get(
        `/api/boards/${boardId}` // GET /api/board/{boardId}
      );
      console.log('message: ', response.data.message);
      return response.data.data;
    } catch (error: any) {
      console.error('board detail get failed:', error);
      throw new Error(error.response.data.message || '게시글 조회 실패');
    }
  }

  // 게시글 등록
  async function createBoard(boardData: any) {
    try {
      const response = await api.post('/api/boards', boardData);
      console.log('Board created successfully:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('board create failed:', error);
      throw new Error(error.response.data.message || '게시글 등록 실패');
    }
  }

  // 게시글 수정
  async function updateBoard(
    boardId: number,
    boardData: { title: string; content: string; userId: number }
  ) {
    try {
      const response = await api.put(`/api/boards/${boardId}`, boardData);
      console.log('Board updated successfully:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('board update failed:', error);
      throw new Error(error.response.data.message || '게시글 수정 실패');
    }
  }

  // 게시글 삭제
  async function deleteBoard(boardId: number, boardData: { userId: number }) {
    try {
      const response = await api.post(`/api/boards/${boardId}`, boardData);
      console.log('Board deleted successfully:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('board delete failed:', error);
      throw new Error(error.response.data.message || '게시글 삭제 실패');
    }
  }

  return {
    isLoaded: dataSource.isLoaded,
    dataItems: dataSource.dataItems,
    total: dataSource.total,
    pageSize: dataSource.pageSize,
    setPage: dataSource.setPage.bind(dataSource),
    setSort: dataSource.setSort.bind(dataSource),
    setFilter: dataSource.setFilter.bind(dataSource),
    fetch: dataSource.fetch.bind(dataSource),
    objectType,
    objectId,
    init,
    getBoardDetail,
    createBoard,
    updateBoard,
    deleteBoard,
  };
});
