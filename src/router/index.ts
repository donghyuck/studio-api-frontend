import { useAuthStore } from "@/stores/studio/mgmt/auth.store";
import { createRouter, createWebHistory } from "vue-router";
import AuthRoutes from "./AuthRoutes"; 
import MainRoutes from "./MainRoutes";
import StudioRoutes from "./StudioMgmtRoutes";
import StudioPublicRoutes from "./StudioPublicRoutes";
import { useNavStore } from "@/stores/studio/mgmt/nav.store";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/:pathMatch(.*)*",
      component: () => import("@/views/pages/Error404.vue"),
    },
    MainRoutes,
    StudioRoutes,
    StudioPublicRoutes,
    AuthRoutes,
  ],
});

let restoreSessionPromise: Promise<boolean> | null = null;

async function restoreSessionIfNeeded(): Promise<boolean> {
  const auth = useAuthStore();
  if (auth.isAuthenticated) {
    return true;
  }
  if (restoreSessionPromise) {
    return restoreSessionPromise;
  }
  restoreSessionPromise = (async () => {
    try {
      await auth.refreshTokens();
      await auth.fetchUser();
      return !!auth.isAuthenticated;
    } catch {
      auth.logout();
      return false;
    } finally {
      restoreSessionPromise = null;
    }
  })();
  return restoreSessionPromise;
}

router.beforeEach(async (to, from, next) => {
  const auth = useAuthStore();

  const needsRestore = Boolean(to.meta.requiresAuth || to.meta.restoreSession);
  if (needsRestore) {
    await restoreSessionIfNeeded();
  }

  if (to.meta.requiresAuth) {
    if (!auth.isAuthenticated) {
      return next(`/auth/login?returnUrl=${to.fullPath}`);
    }

    if (!auth.user) {
      try {
        await auth.fetchUser();
      } catch {
        auth.logout();
        return next(`/auth/login?returnUrl=${to.fullPath}`);
      }
    }

    if (to.meta.roles) {
      const allowedRoles = (to.meta.roles as string[]) || [];
      const userRoles = auth.user?.roles || [];
      const hasRole = allowedRoles.some((role) => userRoles.includes(role));
      if (!hasRole) {
        next("/unauthorized");
        return;
      }
    }
  }

  const nav = useNavStore();
  if (from.name) {
    nav.setPreviousRoute(from);
  }
  next();
});

export default router;
