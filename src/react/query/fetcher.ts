import {
  type AxiosRequestConfig,
  type AxiosResponse,
  type Method,
} from "axios";
import { apiClient } from "@/react/api/client";

interface ApiResponseEnvelope<T> {
  data?: T;
}

interface ApiRequestOptions<TBody>
  extends Omit<AxiosRequestConfig<TBody>, "data" | "method" | "url"> {
  data?: TBody;
}

function unwrapApiResponse<T>(
  response: AxiosResponse<ApiResponseEnvelope<T> | T>
): T {
  const payload = response.data;

  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    "data" in payload
  ) {
    return payload.data as T;
  }

  return payload as T;
}

export async function apiRequest<TResponse, TBody = unknown>(
  method: Method,
  url: string,
  options?: ApiRequestOptions<TBody>
) {
  const response = await apiClient.request<ApiResponseEnvelope<TResponse> | TResponse>({
    ...options,
    method,
    url,
    data: options?.data,
    withCredentials: options?.withCredentials ?? true,
  });

  return unwrapApiResponse(response);
}

export function apiQuery<TResponse>(
  url: string,
  options?: Omit<ApiRequestOptions<never>, "data">
) {
  return apiRequest<TResponse>("get", url, options);
}

export function createApiQueryFn<TResponse>(
  url: string,
  options?: Omit<ApiRequestOptions<never>, "data">
) {
  return () => apiQuery<TResponse>(url, options);
}
