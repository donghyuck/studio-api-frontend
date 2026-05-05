export interface AttachmentDownloadUrlIssueLogEvent {
  logId: number;
  attachmentId: number;
  objectType: number;
  objectId: number;
  endpointKind: "MGMT" | "SERVICE" | string;
  issuedByUserId?: number | null;
  issuedByPrincipalName?: string | null;
  issuedAt: string;
  expiresAt: string;
  ttlSeconds: number;
  storageProviderId: string;
  bucket: string;
  objectKeyHash: string;
  clientIp?: string | null;
  userAgent?: string | null;
}
