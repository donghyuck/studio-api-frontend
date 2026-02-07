import { forumsAdminApi } from "@/data/studio/mgmt/forums";
import type {
  ChangeTopicStatusRequest,
  CreateCategoryRequest,
  CreateForumRequest,
  CreatePostRequest,
  CreateTopicRequest,
  ForumAclRuleRequest,
  ForumAclRuleResponse,
  ForumAclSimulationRequest,
  PermissionActionMetadata,
  PermissionAction,
  UpdateForumSettingsRequest
} from "@/types/studio/forums";
import { resolveAxiosError } from "@/utils/helpers";
import { defineStore } from "pinia";
import { ref } from "vue";

export const useForumAdminStore = defineStore("mgmt-forum-admin-store", () => {
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const setError = (err: unknown) => {
    error.value = resolveAxiosError(err);
  };

  const clearError = () => {
    error.value = null;
  };

  const createForum = async (payload: CreateForumRequest) => {
    clearError();
    try {
      return await forumsAdminApi.createForum(payload);
    } catch (err) {
      setError(err);
      throw err;
    }
  };

  const updateForumSettings = async (
    forumSlug: string,
    payload: UpdateForumSettingsRequest,
    ifMatch: string
  ) => {
    clearError();
    try {
      return await forumsAdminApi.updateForumSettings(forumSlug, payload, ifMatch);
    } catch (err) {
      setError(err);
      throw err;
    }
  };

  const createCategory = async (
    forumSlug: string,
    payload: CreateCategoryRequest
  ) => {
    clearError();
    try {
      return await forumsAdminApi.createCategory(forumSlug, payload);
    } catch (err) {
      setError(err);
      throw err;
    }
  };

  const createTopic = async (
    forumSlug: string,
    categoryId: number,
    payload: CreateTopicRequest
  ) => {
    clearError();
    try {
      return await forumsAdminApi.createTopic(forumSlug, categoryId, payload);
    } catch (err) {
      setError(err);
      throw err;
    }
  };

  const changeTopicStatus = async (
    forumSlug: string,
    topicId: number,
    payload: ChangeTopicStatusRequest,
    ifMatch: string
  ) => {
    clearError();
    try {
      return await forumsAdminApi.changeTopicStatus(
        forumSlug,
        topicId,
        payload,
        ifMatch
      );
    } catch (err) {
      setError(err);
      throw err;
    }
  };

  const createPost = async (
    forumSlug: string,
    topicId: number,
    payload: CreatePostRequest
  ) => {
    clearError();
    try {
      return await forumsAdminApi.createPost(forumSlug, topicId, payload);
    } catch (err) {
      setError(err);
      throw err;
    }
  };

  const permissionActions = ref<PermissionActionMetadata[]>([]);
  const permissionActionsLoading = ref(false);
  const aclRules = ref<ForumAclRuleResponse[]>([]);
  const aclRulesLoading = ref(false);
  const aclError = ref<string | null>(null);

  const loadPermissionActions = async (forumSlug: string) => {
    permissionActionsLoading.value = true;
    aclError.value = null;
    try {
      const response = await forumsAdminApi.listPermissionActions(forumSlug);
      permissionActions.value = response;
      return permissionActions.value;
    } catch (err) {
      aclError.value = resolveAxiosError(err);
      throw err;
    } finally {
      permissionActionsLoading.value = false;
    }
  };

  const loadAclRules = async (forumSlug: string, params?: { categoryId?: number; action?: PermissionAction; role?: string; enabled?: boolean; page?: number; size?: number }) => {
    aclRulesLoading.value = true;
    aclError.value = null;
    try {
      const response = await forumsAdminApi.listPermissionRules(forumSlug, params);
      aclRules.value = response;
      return aclRules.value;
    } catch (err) {
      aclError.value = resolveAxiosError(err);
      throw err;
    } finally {
      aclRulesLoading.value = false;
    }
  };

  const createAclRule = async (forumSlug: string, payload: ForumAclRuleRequest) => {
    aclError.value = null;
    try {
      const response = await forumsAdminApi.createPermissionRule(forumSlug, payload);
      aclRules.value = [...aclRules.value, response];
      return response;
    } catch (err) {
      aclError.value = resolveAxiosError(err);
      throw err;
    }
  };

  const updateAclRule = async (forumSlug: string, ruleId: number, payload: ForumAclRuleRequest) => {
    aclError.value = null;
    try {
      const response = await forumsAdminApi.updatePermissionRule(
        forumSlug,
        ruleId,
        payload
      );
      const rule = response;
      aclRules.value = aclRules.value.map((existing) =>
        existing.ruleId === rule.ruleId ? rule : existing
      );
      return response;
    } catch (err) {
      aclError.value = resolveAxiosError(err);
      throw err;
    }
  };

  const deleteAclRule = async (forumSlug: string, ruleId: number) => {
    aclError.value = null;
    try {
      await forumsAdminApi.deletePermissionRule(forumSlug, ruleId);
      aclRules.value = aclRules.value.filter((rule) => rule.ruleId !== ruleId);
    } catch (err) {
      aclError.value = resolveAxiosError(err);
      throw err;
    }
  };

  const simulateAclDecision = async (
    forumSlug: string,
    payload: ForumAclSimulationRequest
  ) => {
    try {
      return await forumsAdminApi.simulatePermission(forumSlug, payload);
    } catch (err) {
      throw err;
    }
  };

  return {
    isLoading,
    error,
    clearError,
    createForum,
    updateForumSettings,
    createCategory,
    createTopic,
    changeTopicStatus,
    createPost,
    permissionActions,
    permissionActionsLoading,
    loadPermissionActions,
    aclRules,
    aclRulesLoading,
    aclError,
    loadAclRules,
    createAclRule,
    updateAclRule,
    deleteAclRule,
    simulateAclDecision,
  };
});
