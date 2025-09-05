const BoardRoutes = {
  path: '/peis',
  component: () => import('@/layouts/full/FullLayout.vue'),
  meta: {
    requiresAuth: true,
  },
  children: [
    {
      name: 'BoardList',
      path: 'board/list',
      component: () => import('@/views/board/BoardList.vue'),
    },
    {
      name: 'BoardDetail',
      path: 'board/detail/:boardId',
      component: () => import('@/views/board/BoardDetail.vue'),
    },
    {
      name: 'BoardEdit',
      path: 'board/edit/:boardId?',
      component: () => import('@/views/board/BoardEdit.vue'),
    },
  ],
};
export default BoardRoutes;
