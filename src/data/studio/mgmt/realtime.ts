import type { RealtimeClient } from "@/types/studio/realtime";
import { Client } from "@stomp/stompjs";
import { WS_BASE_URL } from "@/config/backend";
import { authStore } from "@/react/auth/store";
import { parseJwtExp } from "@/utils/jwt";

function isTokenExpired(token: string, skewSeconds = 30) {
  const exp = parseJwtExp(token);
  if (!exp) return true;
  return exp < Math.floor(Date.now() / 1000) + skewSeconds;
}

export class StompRealtimeClient implements RealtimeClient {
  private client: Client;
  constructor(private token?: string) {
    this.client = new Client({
      brokerURL: `${WS_BASE_URL}/ws`,
      reconnectDelay: 5000,
    });

    this.client.beforeConnect = async () => {
      try {
        const state = authStore.getState();
        let currentToken = state.token;

        if (!currentToken) {
          currentToken = await state.refreshTokens();
        } else if (isTokenExpired(currentToken)) {
          currentToken = await state.refreshTokens();
        }

        if (currentToken) {
          this.client.connectHeaders = {
            Authorization: `Bearer ${currentToken}`,
          };
        } else {
          this.client.connectHeaders = {};
        }
      } catch (error) {
        console.error("[STOMP] Failed to refresh token in beforeConnect:", error);
        this.client.connectHeaders = {};
      }
    };

    this.client.onStompError = (frame) => {
      console.error("[STOMP] Broker error:", frame.headers["message"]);
      console.error("[STOMP] Additional details:", frame.body);
    };

    this.client.onWebSocketClose = (event) => {
      console.warn("[STOMP] WebSocket connection closed:", event);
    };
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
