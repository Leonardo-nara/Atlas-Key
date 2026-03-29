export interface OrderAuditEvent {
  id: string;
  orderId: string;
  type: "created" | "accepted" | "picked_up" | "delivered" | "cancelled";
  actorUserId?: string | null;
  actorRole?: "STORE_ADMIN" | "COURIER" | null;
  actorName?: string | null;
  actorEmail?: string | null;
  reason?: string | null;
  createdAt: string;
}
