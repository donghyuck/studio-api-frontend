import type { PageResponse } from "@/types/studio/api-common";

export interface LoginFailureEvent {
  id: number;
  occurredAt: string;
  username: string;
  remoteIp: string;
  failureType: string;
  message: string;
  userAgent?: string | null;
}
