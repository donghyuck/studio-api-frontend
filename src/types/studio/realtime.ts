export interface RealtimeClient {
  connect(): void;
  disconnect(): void;
  subscribe(destination: string, callback: (payload: any) => void): void;
}
