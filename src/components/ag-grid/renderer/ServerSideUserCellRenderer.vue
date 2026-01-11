<template>
    <v-list-item v-if="userId>0" class="w-100">
        <template v-slot:prepend>
            <v-avatar size="24" color="grey-darken-3" :image="profileImageUrl"></v-avatar>
        </template>
        <v-list-item-title class="text-body-2">{{ usernameText }}</v-list-item-title>
    </v-list-item>
</template>

<script setup lang="ts">
import NO_AVATAR from "@/assets/images/users/no-avatar.png";
import { getProfileImageUrl, getUserBasic } from "@/data/studio/user";
import type { UserBasicDto } from "@/types/studio/user";
import { computed, ref, watchEffect } from "vue";

const props = defineProps<{ params: any }>();

const cache = new Map<number, UserBasicDto>();
const user = ref<UserBasicDto | null>(null);

const userIdRaw = computed(() => props.params?.value);
const userId = computed(() => Number(userIdRaw.value ?? 0));

watchEffect(async () => {
    const id = userId.value;
    if (!Number.isFinite(id) || id <= 0) {
        user.value = null;
        return;
    }
    const cached = cache.get(id);
    if (cached) {
        user.value = cached;
        return;
    }
    try {
        const basic = await getUserBasic(id);
        cache.set(id, basic);
        user.value = basic;
    } catch {
        user.value = null;
    }
});

const profileImageUrl = computed(() => {
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
</script>
