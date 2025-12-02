import { useAuthStore } from "@/stores/studio/auth.store";
import { createRouter, createWebHistory } from "vue-router";
import AuthRoutes from "./AuthRoutes";
import BoardRoutes from "./BoardRoutes";
import MainRoutes from "./MainRoutes";
import StudioRoutes from "./StudioRoutes";
import { useNavStore } from "@/stores/studio/nav.store";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/:pathMatch(.*)*",
      component: () => import("@/views/pages/Error404.vue"),
    },
    MainRoutes,
    StudioRoutes,
    AuthRoutes,
    BoardRoutes,
  ],
});

router.beforeEach(async (to, from, next) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth) {
    // 로그인 안 되어 있으면 로그인 페이지로
    if (!auth.isAuthenticated) {
      return next(`/auth/login?returnUrl=${to.fullPath}`);
    }

    // 로그인 되어 있지만 user 정보가 없으면 fetch
    if (!auth.user) {
      try {
        await auth.fetchUser();
      } catch (error) {
        console.warn("사용자 정보 로드 실패, 로그아웃 처리");
        // auth.logout();
        // return next(`/auth/login?returnUrl=${to.fullPath}`);
      }
    }

    // roles 확인 (권한 체크)
    if ( to.meta.roles) {
      const allowedRoles = to.meta.roles as string[] || [];
      const userRoles = auth.user?.roles || [];
      const hasRole = allowedRoles.some((role) => userRoles.includes(role));
      if (!hasRole) {
        next("/unauthorized"); // 혹은 403 페이지로
        return;
      }
    }
  }
  // 모든 조건 통과
  const nav = useNavStore()
  if(from.name)
    nav.setPreviousRoute(from);
  next();
});

export default router;
