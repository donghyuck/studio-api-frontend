import { defineStore } from "pinia";
import { ref } from "vue";
import { forumsPublicApi } from "@/data/studio/public/forums";
import type {
  ForumAuthzActionPermission,
  ForumAuthzResponse,
  ForumPermissionDecision,
  PermissionAction,
} from "@/types/studio/forums";
import { resolveAxiosError } from "@/utils/helpers";

export const usePublicForumAuthzStore = defineStore(
  "public-forum-authz-store",
  () => {
    const cache = ref<Record<string, ForumAuthzResponse>>({});
    const loading = ref(false);
    const error = ref<string | null>(null);

    const loadForumAuthz = async (forumSlug: string) => {
      loading.value = true;
      error.value = null;
      try {
      const response = await forumsPublicApi.getForumAuthz(forumSlug);
      const payload = response;
      const allowedActions = (payload as ForumAuthzActionPermission[])
        .filter((entry) => entry.allowed)
        .map((entry) => entry.action);
      const forumAuthz: ForumAuthzResponse = {
        forumSlug,
        allowedActions,
        decisions: [],
      };
      cache.value = { ...cache.value, [forumSlug]: forumAuthz };
      return forumAuthz;
      } catch (err) {
        error.value = resolveAxiosError(err);
        throw err;
      } finally {
        loading.value = false;
      }
    };

    const hasPermission = (forumSlug: string, action: PermissionAction) => {
      const entry = cache.value[forumSlug];
      if (!entry) {
        return false;
      }
      return entry.allowedActions.includes(action);
    };

    const getDecision = (
      forumSlug: string,
      action: PermissionAction
    ): ForumPermissionDecision | undefined => {
      const entry = cache.value[forumSlug];
      return entry?.decisions.find((decision) => decision.action === action);
    };

    return {
      cache,
      loading,
      error,
      loadForumAuthz,
      hasPermission,
      getDecision,
    };
  }
);
