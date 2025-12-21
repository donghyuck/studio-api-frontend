import type { RealtimeClient } from "@/types/studio/realtime";
import { Client } from "@stomp/stompjs";
import { WS_BASE_URL } from "@/config/backend";
import { authHeader } from "./auth";

export class StompRealtimeClient implements RealtimeClient {
  private client: Client;
  constructor(private token?: string) {
    this.client = new Client({
      brokerURL: `${WS_BASE_URL}/ws`,
      reconnectDelay: 5000,
      connectHeaders: {...authHeader()}
    });
  }

  connect() {
    this.client.activate();
  }

  disconnect() {
    this.client.deactivate();
  }

  subscribe(destination: string, callback: (payload: any) => void) {
    this.client.onConnect = () => {
      console.log(`[STOMP] connected, subscribing to ${destination}`);
      this.client.subscribe(destination, msg => {
        callback(JSON.parse(msg.body));
      });
    };
  }
}