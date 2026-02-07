<template>
    <v-list-item class="w-100 pa-0" v-if="user">
        <template v-slot:prepend>
          <v-avatar
            size="24"
            color="grey-darken-3"
            :image="profileImageUrl"
          ></v-avatar>
        </template> 
        <v-list-item-title class="text-body-2">{{ usernameText }}</v-list-item-title> 
        <!-- <v-list-item-subtitle v-if="emailText">{{ emailText }}</v-list-item-subtitle>   -->
      </v-list-item>
</template>
<script setup lang="ts">
import NO_AVATAR from "@/assets/images/users/no-avatar.png";
import { getProfileImageUrl } from "@/data/studio/public/user";
import { useUserBasicStore } from "@/stores/studio/mgmt/user.basic.store";
import type { UserBasicDto } from "@/types/studio/user";
import { computed, ref, watchEffect } from "vue";

const props = defineProps<{ params: any }>();

const user = ref<UserBasicDto | null>(null);
const userStore = useUserBasicStore();

const userIdRaw = computed(() => props.params?.value);
const userId = computed(() => Number(userIdRaw.value ?? 0));

watchEffect(async () => {
    const id = userId.value;
    if (!Number.isFinite(id) || id <= 0) {
        user.value = null;
        return;
    }
    try {
        const basic = await userStore.fetch(id);
        user.value = basic;
    } catch {
        user.value = null;
    }
});

const profileImageUrl = computed(() => {
    const username = user.value?.username?.trim();
    if (username) return getProfileImageUrl(username);
    const identifier = userIdRaw.value ?? user.value?.userId;
    if (identifier == null) return NO_AVATAR;
    return getProfileImageUrl(identifier);
});

const usernameText = computed(() => {
    const name = user.value?.username ?? "";
    if (name.trim().length > 0) return name;
    const id = userId.value;
    if (!Number.isFinite(id) || id <= 0) return "Unknown";
    return `${id}`;
});

const emailText = computed(() => {
    const email = user.value?.email ?? "";
    const trimmed = email.trim();
    return trimmed.length > 0 ? trimmed : "";
});
</script>
