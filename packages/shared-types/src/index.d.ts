export type RuntimeStage = "development" | "staging" | "production";

export interface AppEnvironment {
  appName: "backend" | "desktop" | "mobile";
  stage: RuntimeStage;
  apiBaseUrl: string;
}

export interface HealthStatus {
  service: "backend" | "desktop" | "mobile";
  status: "ok";
  timestamp: string;
}

export type RealtimeOrderEventName =
  | "orders.created"
  | "orders.accepted"
  | "orders.status_updated"
  | "orders.cancelled";

export interface RealtimeOrderSnapshot {
  id: string;
  storeId: string;
  courierId?: string | null;
  status: string;
  statusLabel?: string;
  customerName: string;
  total: number;
  updatedAt: string;
}

export interface RealtimeOrderEventPayload {
  event: RealtimeOrderEventName;
  order: RealtimeOrderSnapshot;
  occurredAt: string;
}
