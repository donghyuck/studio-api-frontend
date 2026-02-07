import { StompRealtimeClient } from "@/data/studio/mgmt/realtime";
import { useNotificationsStore } from "@/stores/notifications.store";
import type { MailSyncLogDto } from "@/types/studio/mail";
import { defineStore } from "pinia";
import { ref } from "vue";

// 사용법:
// - 앱 전역(예: App.vue)에서 useMailSyncRealtimeStore().start()를 1회 호출합니다.
// - 이후 mail-sync 이벤트가 오면 자동으로 토스트 알림이 표시됩니다.
// - 필요 시 lastEvent를 watch하여 화면을 갱신할 수 있습니다.
export const useMailSyncRealtimeStore = defineStore(
  "mgmt-mail-sync-realtime",
  () => {
    const notifications = useNotificationsStore();
    const client = new StompRealtimeClient();
    const started = ref(false);
    const lastEvent = ref<MailSyncLogDto | null>(null);

    const start = () => {
      if (started.value) return;
      started.value = true;
      client.connect();
      client.subscribe("/topic/mail-sync", (payload: any) => {
        if (payload?.log) {
          payload = payload.log;
        }
        lastEvent.value = payload as MailSyncLogDto;
        if (payload.status === "completed") {
          notifications.add({
            type: "success",
            title: `메일 동기화 완료 (#${payload.logId})`,
            message: `전체 ${payload.processed} 중 ${payload.succeeded} 성공`,
          });
        } else if (payload.status === "failed") {
          notifications.add({
            type: "error",
            title: `메일 동기화 실패 (#${payload.logId})`,
            message: payload.message || "실패 사유 없음",
          });
        }
      });
    };
    return {
      started,
      lastEvent,
      start,
    };
  }
);
