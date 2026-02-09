const StudioPublicRoutes = {
  path: '/community',
  component: () => import('@/layouts/full/FullLayout.vue'),
  meta: {
    requiresAuth: false,
    restoreSession: true,
  },
  redirect: '/community/forums',
  children: [
    {
      name: 'CommunityForums',
      path: 'forums',
      component: () => import('@/views/studio/public/community/ForumListPage.vue'),
    },
    {
      name: 'CommunityForumTopics',
      path: 'forums/:forumSlug/topics',
      component: () => import('@/views/studio/public/community/ForumTopicListPage.vue'),
    },
    {
      name: 'CommunityForumTopicDetail',
      path: 'forums/:forumSlug/topics/:topicId',
      component: () => import('@/views/studio/public/community/ForumTopicDetailPage.vue'),
    },
  ],
};

export default StudioPublicRoutes;
