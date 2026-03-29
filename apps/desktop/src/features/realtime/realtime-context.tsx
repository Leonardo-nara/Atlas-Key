import type {
  RealtimeOrderEventName,
  RealtimeOrderEventPayload
} from "@deliveries/shared-types";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { io, type Socket } from "socket.io-client";

import { env } from "../../lib/env";
import { useAuth } from "../auth/auth-context";

const ORDER_EVENTS: RealtimeOrderEventName[] = [
  "orders.created",
  "orders.accepted",
  "orders.status_updated",
  "orders.cancelled"
];

type OrderEventListener = (payload: RealtimeOrderEventPayload) => void;

interface RealtimeContextValue {
  isConnected: boolean;
  subscribeToOrderEvents: (listener: OrderEventListener) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef(new Set<OrderEventListener>());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      return;
    }

    const socket = io(env.socketUrl, {
      auth: { token },
      transports: ["websocket"]
    });

    const handleOrderEvent = (payload: RealtimeOrderEventPayload) => {
      for (const listener of listenersRef.current) {
        listener(payload);
      }
    };

    socketRef.current = socket;
    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    for (const eventName of ORDER_EVENTS) {
      socket.on(eventName, handleOrderEvent);
    }

    return () => {
      for (const eventName of ORDER_EVENTS) {
        socket.off(eventName, handleOrderEvent);
      }

      socket.off("connect");
      socket.off("disconnect");
      socket.disconnect();

      if (socketRef.current === socket) {
        socketRef.current = null;
      }

      setIsConnected(false);
    };
  }, [token]);

  const value = useMemo<RealtimeContextValue>(
    () => ({
      isConnected,
      subscribeToOrderEvents(listener) {
        listenersRef.current.add(listener);

        return () => {
          listenersRef.current.delete(listener);
        };
      }
    }),
    [isConnected]
  );

  return (
    <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const context = useContext(RealtimeContext);

  if (!context) {
    throw new Error("useRealtime deve ser usado dentro de RealtimeProvider");
  }

  return context;
}
