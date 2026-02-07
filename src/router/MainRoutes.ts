import { requiredAdminRoles } from "@/utils/helpers";

const MainRoutes = {
  path: "/main",
  meta: {
    requiresAuth: false,
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
