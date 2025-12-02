import instance from '@/plugins/axios';

function pickPayload<T>(res: any): T {
  // 응답이 AxiosResponse면 res.data, 이미 언래핑돼 있으면 res 자체
  const body = res?.data ?? res
  if (body && typeof body === 'object') {
    if ('data' in body)   return (body as any).data as T   // { data: ... }
    if ('result' in body) return (body as any).result as T // { result: ... }
  }
  return body as T
}

export const api = {
  get<T>(url: string, config?: any) {
    return instance.get(url, config).then(pickPayload<T>)
  },
  post<T>(url: string, data?: any, config?: any) {
    return instance.post(url, data, config).then(pickPayload<T>)
  },
  put<T>(url: string, data?: any, config?: any) {
    return instance.put(url, data, config).then(pickPayload<T>)
  },
  patch<T>(url: string, data?: any, config?: any) {
    return instance.patch(url, data, config).then(pickPayload<T>)
  }, 
  delete<T>(url: string,  data?: any, config?: any) {
    return instance.delete(url, { ...config, data: data } ).then(pickPayload<T>)
  },
}

