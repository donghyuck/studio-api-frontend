import { ReactPageDataSource } from "@/react/pages/admin/datasource";
import type { MailMessageDto, MailSyncLogDto } from "@/types/studio/mail";
import { apiRequest } from "@/react/query/fetcher";

export class MailInboxDataSource extends ReactPageDataSource<MailMessageDto> {
  constructor() {
    super("/api/mgmt/mail");
  }

  getMessage(mailId: number) {
    return apiRequest<MailMessageDto>("get", `/api/mgmt/mail/${mailId}`);
  }
}

export class MailSyncLogDataSource extends ReactPageDataSource<MailSyncLogDto> {
  constructor() {
    super("/api/mgmt/mail/sync/logs/page");
  }
}
