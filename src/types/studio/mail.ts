
export interface MailSyncLogDto {
  logId: number;
  startedAt: string | null;   // Instant → ISO 문자열
  finishedAt: string | null;  // Instant → ISO 문자열
  processed: number;
  succeeded: number;
  failed: number;
  status: string;
  message: string;
  triggeredBy: string;
}

export interface MailAttachmentDto {
  attachmentId: number;
  filename: string;
  contentType: string;
  size: number;
}

export interface MailMessageDto {
  mailId: number;
  folder: string;
  uid: number;
  messageId: string;
  subject: string;
  fromAddress: string;
  toAddress: string;
  ccAddress: string;
  bccAddress: string;
  sentAt: string | null;       // Instant → string or null
  receivedAt: string | null;   // Instant → string or null
  flags: string;
  body: string;
  properties: Record<string, string>;
  attachments: MailAttachmentDto[];
}