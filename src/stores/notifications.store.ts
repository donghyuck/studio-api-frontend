import { defineStore } from "pinia";
import { computed, ref } from "vue";

export type NotificationType = "success" | "error" | "info";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  createdAt: number;
  read: boolean;
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const useNotificationsStore = defineStore("app-notifications", () => {
  const maxItems = 20;
  const items = ref<NotificationItem[]>([]);

  const unreadCount = computed(() => items.value.filter((n) => !n.read).length);

  const add = (payload: Omit<NotificationItem, "id" | "createdAt" | "read">) => {
    const next: NotificationItem = {
      id: createId(),
      createdAt: Date.now(),
      read: false,
      ...payload,
    };
    items.value = [next, ...items.value].slice(0, maxItems);
  };

  const markRead = (id: string) => {
    items.value = items.value.map((item) =>
      item.id === id ? { ...item, read: true } : item
    );
  };

  const markAllRead = () => {
    items.value = items.value.map((item) => ({ ...item, read: true }));
  };

  const remove = (id: string) => {
    items.value = items.value.filter((item) => item.id !== id);
  };

  const clear = () => {
    items.value = [];
  };

  return {
    items,
    unreadCount,
    add,
    markRead,
    markAllRead,
    remove,
    clear,
  };
});
