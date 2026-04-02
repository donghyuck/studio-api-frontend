import { QueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";

function shouldRetryRequest(failureCount: number, error: unknown) {
  if (isAxiosError(error)) {
    const status = error.response?.status;

    if (status === 401 || status === 403) {
      return false;
    }
  }

  // Keep retries conservative during the initial React Query rollout:
  // one retry for transient failures, none for auth failures.
  return failureCount < 1;
}

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryRequest,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
