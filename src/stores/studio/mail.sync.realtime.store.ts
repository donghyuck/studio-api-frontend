import { StompRealtimeClient } from "@/data/studio/realtime";
import { useToast } from "@/plugins/toast";
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
    const toast = useToast();
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
          toast.success(
            `동기화 요청{${payload.logId}) 작업이 완료되었습니다. 전체 ${payload.processed} 중 ${payload.succeeded} 성공.`,
            { timeout: -1 }
          );
        } else if (payload.status === "failed") {
          toast.error(
            `동기화 요청{${payload.logId}) 작업이 싪패하였습니다. ${payload.message}`,
            { timeout: -1 }
          );
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
