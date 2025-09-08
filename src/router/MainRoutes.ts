const MainRoutes = {
  path: "/main",
  meta: {
    requiresAuth: true,
  },
  redirect: "/main",
  component: () => import("@/layouts/full/FullLayout.vue"),
  children: [
    {
      name: "Dashboard",
      path: "/",
      component: () => import("@/views/dashboard/index.vue"),
    },
    {
      name: "FileUploaded",
      path: "/files",
      meta: {
        requiresAuth: true,
        roles: ["ROLE_USER", `${import.meta.env.VITE_REQUIRED_ADMIN_ROLE}`],
      },
      component: () => import("@/views/file/FilesPage.vue"),
    },
     {
      name: "FileUpload",
      path: "/file/upload",
      meta: {
        requiresAuth: true,
        roles: ["ROLE_USER", "ROLE_ADMINISTRATOR"],
      },
      component: () => import("@/views/file/FileUploadPage.vue"),
    },   
    {
      name: "Typography",
      path: "/ui/typography",
      component: () => import("@/views/components/Typography.vue"),
    },
    {
      name: "Shadow",
      path: "/ui/shadow",
      meta: {
        requiresAuth: true,
        roles: ["ROLE_ADMINISTRATOR"],
      },
      component: () => import("@/views/components/Shadow.vue"),
    },
    {
      name: "Alert",
      path: "/ui/alerts",
      component: () => import("@/views/ui-components/Alerts.vue"),
    },
    {
      name: "Buttons",
      path: "/ui/buttons",
      component: () => import("@/views/ui-components/Buttons.vue"),
    },
    {
      name: "Cards",
      path: "/ui/cards",
      component: () => import("@/views/ui-components/Cards.vue"),
    },
    {
      name: "Tables",
      path: "/ui/tables",
      component: () => import("@/views/ui-components/Tables.vue"),
    },
    {
      name: "Icons",
      path: "/icons",
      component: () => import("@/views/pages/Icons.vue"),
    },
    {
      name: "Starter",
      path: "/sample-page",
      component: () => import("@/views/pages/SamplePage.vue"),
    },
    // ✅ 권한 부족 페이지 추가
    {
      name: "Unauthorized",
      path: "/unauthorized",
      component: () => import("@/views/pages/Unauthorized.vue"),
      meta: {
        requiresAuth: true,
      },
    },
  ],
};

export default MainRoutes;
