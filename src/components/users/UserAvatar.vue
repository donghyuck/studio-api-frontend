<template> 
  <div class="user-avatar" :class="{ 'user-avatar--stacked': showDetails }">
    <v-avatar :size="size" :color="color">
      <v-img v-if="!showInitialOverlay"
                :alt="displayName"
                :src="avatarImageUrl"></v-img>
      <span v-else class="text-caption">
        {{ initial }}
      </span>
    </v-avatar>
    <div v-if="showDetails" class="user-avatar__info">
      <div class="user-avatar__name">{{ displayName }}</div>
      <div class="user-avatar__email" v-if="displayEmail">{{ displayEmail }}</div>
      <div class="user-avatar__debug" v-if="showDebugUrl">{{ avatarImageUrl }}</div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import { getProfileImageUrl } from '@/data/studio/public/user';
import { usePublicUserStore } from '@/stores/studio/public/user.public.store';
import type { UserPublicDto } from '@/types/studio/user';

interface Props {
  userId?: number | string
  username?: string
  name?: string
  email?: string
  size?: number | string
  color?: string
  imageUrl?: string
  imageById?: boolean
  showImage?: boolean
  showDebugUrl?: boolean
  showInitial?: boolean
  showName?: boolean
  showEmail?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 32,
  color: 'grey-lighten-1',
  imageById: false,
  showImage: true,
  showDebugUrl: false,
  showInitial: true,
  showName: false,
  showEmail: false,
});

const showDetails = computed(() => props.showName || props.showEmail);
const userStore = usePublicUserStore();
const fetchedUser = ref<UserPublicDto | null>(null);

watchEffect(async () => {
  if (!showDetails.value) {
    fetchedUser.value = null;
    return;
  }
  if (props.name || props.email) {
    return;
  }
  const id = props.userId;
  const username = props.username?.trim();
  try {
    if (username) {
      fetchedUser.value = await userStore.fetchByUsername(username);
    } else if (id != null && String(id).trim()) {
      fetchedUser.value = await userStore.fetchById(id);
    } else {
      fetchedUser.value = null;
    }
  } catch {
    fetchedUser.value = null;
  }
});

const imageIdentifier = computed(() => {
  const name = props.username?.trim();
  if (!props.imageById && name) return name;
  if (props.userId != null && String(props.userId).trim()) return props.userId;
  return name || undefined;
});

const imageUrl = computed(() => props.imageUrl ?? getProfileImageUrl(imageIdentifier.value as any));
const avatarImageUrl = computed(() => (props.showImage ? imageUrl.value : undefined));
const showInitialOverlay = computed(
  () => props.showInitial && (!props.showImage || !avatarImageUrl.value)
);

const displayName = computed(() => {
  if (!props.showName) return '';
  const name =
    props.name ||
    fetchedUser.value?.name ||
    '';
  const username =
    props.username ||
    fetchedUser.value?.username ||
    '';
  if (name && username) return `${name}(${username})`;
  if (name) return name;
  if (username) return username;
  return props.userId != null ? String(props.userId) : 'Unknown';
});

const displayEmail = computed(() => {
  if (!props.showEmail) return '';
  return props.email || fetchedUser.value?.email || '';
});

const initial = computed(() => {
  const name = props.username?.trim();
  if (name && name.length > 0) return name.slice(0, 1).toUpperCase();
  const id = props.userId;
  if (id == null) return '?';
  return String(id).slice(0, 1).toUpperCase();
});
</script>

<style scoped>
.user-avatar {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.user-avatar__info {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.user-avatar__name {
  font-size: 0.875rem;
  color: #1f2937;
}
.user-avatar__email {
  font-size: 0.75rem;
  color: #6b7280;
}
.user-avatar__debug {
  font-size: 0.7rem;
  color: #6b7280;
  word-break: break-all;
}
</style>
