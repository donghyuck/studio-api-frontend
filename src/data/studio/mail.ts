import { API_BASE_URL } from "@/config/backend";
import type { MailSyncLogDto } from "@/types/studio/mail";
import { api } from "@/utils/http";
import { EventSourcePolyfill } from 'event-source-polyfill';
import { authHeader } from "./auth";

const API_BASE = "/api/mgmt/mail";

export async function mailSync() {
  const data = await api.post<number>(`${API_BASE}/sync`);
  return data;
} 

export async function deleteMail(mailId: number): Promise<void> {
  await api.delete<void>(`${API_BASE}/${mailId}`);
}

export function subscribeMailSync(
  onMessage: (payload: MailSyncLogDto) => void,
  onError?: (err: any) => void,
  reconnect: boolean = true
) {
  let es: EventSource | null = null;

  const connect = () => {
    es = new EventSourcePolyfill(`${API_BASE_URL}${API_BASE}/sync/stream`, 
      { headers: authHeader() }
    );
    es.onopen = () => {
      console.log('[SSE] mail-sync connected');
    };
    es.addEventListener('mail-sync', (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as MailSyncLogDto;
        onMessage(payload);
      } catch (e) {
        console.error('[SSE] parse error', e);
      }
    });
    es.onerror = (err) => {
      console.error('[SSE] mail-sync error', err);
      es?.close();
      onError?.(err);
      if (reconnect) {
        console.log('[SSE] reconnecting in 2 sec…');
        setTimeout(connect, 2000);
      }
    };
  };
  connect();
  return () => {
    reconnect = false;
    es?.close();
  };
}
