<script setup lang="ts">
import { computed } from 'vue';
import dayjs from 'dayjs';
import { BellRingingIcon } from 'vue-tabler-icons';
import { useNotificationsStore, type NotificationType } from '@/stores/notifications.store';

const notifications = useNotificationsStore();
const items = computed(() => notifications.items);
const unreadCount = computed(() => notifications.unreadCount);
const badgeContent = computed(() => (unreadCount.value > 99 ? '99+' : `${unreadCount.value}`));

const typeIcon = (type: NotificationType) => {
  if (type === 'success') return 'mdi-check-circle-outline';
  if (type === 'error') return 'mdi-alert-circle-outline';
  return 'mdi-information-outline';
};

const typeColor = (type: NotificationType) => {
  if (type === 'success') return 'success';
  if (type === 'error') return 'error';
  return 'info';
};

const markRead = (id: string) => notifications.markRead(id);
const remove = (id: string) => notifications.remove(id);
const markAllRead = () => notifications.markAllRead();
const clear = () => notifications.clear();
</script>

<template>
  <v-menu :close-on-content-click="false">
    <template v-slot:activator="{ props }">
      <v-btn icon variant="text" class="custom-hover-primary ml-0 ml-md-1 text-muted" v-bind="props">
        <v-badge :content="badgeContent" :model-value="unreadCount > 0" color="primary" offset-x="-5" offset-y="-3">
          <BellRingingIcon stroke-width="1.5" size="22" />
        </v-badge>
      </v-btn>
    </template>
    <v-sheet rounded="md" width="360" elevation="10" class="mt-2">
      <div class="d-flex align-center justify-space-between px-4 py-3">
        <div class="text-subtitle-1">알림</div>
        <div class="d-flex align-center ga-1">
          <v-btn size="x-small" variant="text" @click="markAllRead" :disabled="unreadCount === 0">
            모두 읽음
          </v-btn>
          <v-btn size="x-small" variant="text" color="error" @click="clear" :disabled="items.length === 0">
            전체 삭제
          </v-btn>
        </div>
      </div>
      <v-divider />
      <v-list class="py-0" density="compact">
        <v-list-item v-if="items.length === 0">
          <v-list-item-title class="text-body-2 text-grey-darken-1">
            표시할 알림이 없습니다.
          </v-list-item-title>
        </v-list-item>
        <v-list-item v-for="item in items" :key="item.id" @click="markRead(item.id)"
          :class="['notification-item', { 'notification-item--unread': !item.read }]">
          <template #prepend>
            <v-icon :color="typeColor(item.type)">{{ typeIcon(item.type) }}</v-icon>
          </template>
          <v-list-item-title class="text-body-2">
            {{ item.title }}
          </v-list-item-title>
          <v-list-item-subtitle class="text-caption text-grey-darken-1">
            {{ item.message }}
          </v-list-item-subtitle>
          <template #append>
            <div class="d-flex align-center ga-1">
              <div class="text-caption text-grey-darken-1">
                {{ dayjs(item.createdAt).format('HH:mm') }}
              </div>
              <v-btn icon variant="text" size="x-small" @click.stop="remove(item.id)">
                <v-icon size="16">mdi-close</v-icon>
              </v-btn>
            </div>
          </template>
        </v-list-item>
      </v-list>
    </v-sheet>
  </v-menu>
</template>

<style scoped>
.notification-item--unread {
  background: rgba(33, 150, 243, 0.06);
}
</style>
