const MainRoutes = {
  path: "/",
  meta: {
    requiresAuth: false,
    restoreSession: true,
  },
  component: () => import("@/layouts/full/FullLayout.vue"),
  children: [
    {
      name: "Dashboard",
      path: "",
      component: () => import("@/views/dashboard/index.vue"),
      meta: {
        requiresAuth: false,
        restoreSession: true,
      },
    },
    {
      name: "MyProfile",
      path: "self/profile",
      component: () => import("@/views/studio/profile/MyProfilePage.vue"),
      meta: {
        requiresAuth: true,
      },
    },
    {
      name: "Starter",
      path: "sample-page",
      component: () => import("@/views/pages/SamplePage.vue"),
    },
    // ✅ 권한 부족 페이지 추가
    {
      name: "Unauthorized",
      path: "unauthorized",
      component: () => import("@/views/pages/Unauthorized.vue"),
      meta: {
        requiresAuth: true,
      },
    },
  ],
};

export default MainRoutes;
