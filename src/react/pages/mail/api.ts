import { apiRequest } from "@/react/query/fetcher";
import { subscribeMailSync as subscribeMailSyncSource } from "@/data/studio/mgmt/mail";
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
    return subscribeMailSyncSource(onMessage, onError, true);
  },
};
