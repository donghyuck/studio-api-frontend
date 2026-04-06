import { apiQuery } from "@/react/query/fetcher";
import type { PageResponse } from "@/types/studio/api-common";

export interface LoginFailureEvent {
  id: string;
  timestamp: string;
  username: string;
  ipAddress: string;
  reason: string;
}

export const loginFailuresApi = {
  getLoginFailureEvents: (page: number, size: number) => {
    return apiQuery<PageResponse<LoginFailureEvent>>(`/api/mgmt/audit/login-failures?page=${page}&size=${size}`);
  },
};
