import type { PageResponse } from "@/types/studio/api-common";

export interface LoginFailureEvent {
  id: string;
  timestamp: string;
  username: string;
  ipAddress: string;
  reason: string;
}
