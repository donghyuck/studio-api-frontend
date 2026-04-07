import { apiRequest } from "@/react/query/fetcher";
import { EventSourcePolyfill } from "event-source-polyfill";
import { API_BASE_URL } from "@/config/backend";
import { authStore } from "@/react/auth/store";
import type { PageResponse } from "@/types/studio/api-common";
import type { MailMessageDto, MailSyncLogDto } from "@/types/studio/mail";

const BASE = "/api/mgmt/mail";

export const reactMailApi = {
  listInbox(params?: { page?: number; size?: number; q?: string; fields?: string }) {
    return apiRequest<PageResponse<MailMessageDto>>("get", BASE, { params });
  },

  getMessage(mailId: number) {
    return apiRequest<MailMessageDto>("get", `${BASE}/${mailId}`);
  },

  deleteMessage(mailId: number) {
    return apiRequest<void>("delete", `${BASE}/${mailId}`);
  },

  startSync() {
    return apiRequest<number>("post", `${BASE}/sync`);
  },

  listSyncLogs(params?: { page?: number; size?: number }) {
    return apiRequest<PageResponse<MailSyncLogDto>>("get", `${BASE}/sync/logs/page`, {
      params,
    });
  },

  subscribeSync(
    onMessage: (payload: MailSyncLogDto) => void,
    onError?: (err: unknown) => void
  ) {
    let reconnect = true;
    let timer: number | undefined;
    let eventSource: EventSource | null = null;

    const connect = () => {
      const token = authStore.getState().token;
      eventSource = new EventSourcePolyfill(`${API_BASE_URL}${BASE}/sync/stream`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      eventSource.addEventListener("mail-sync", (event: MessageEvent) => {
        try {
          onMessage(JSON.parse(event.data) as MailSyncLogDto);
        } catch (error) {
          onError?.(error);
        }
      });

      eventSource.onerror = (error) => {
        eventSource?.close();
        onError?.(error);
        if (reconnect) {
          timer = window.setTimeout(connect, 2000);
        }
      };
    };

    connect();

    return () => {
      reconnect = false;
      if (timer != null) {
        window.clearTimeout(timer);
      }
      eventSource?.close();
    };
  },
};
