export interface OrderAuditEvent {
  id: string;
  orderId: string;
  type:
    | "created"
    | "accepted"
    | "picked_up"
    | "delivered"
    | "cancelled"
    | "payment_paid"
    | "payment_proof_submitted"
    | "payment_proof_approved"
    | "payment_proof_rejected";
  actorUserId?: string | null;
  actorRole?: "STORE_ADMIN" | "COURIER" | "CLIENT" | null;
  actorName?: string | null;
  actorEmail?: string | null;
  reason?: string | null;
  createdAt: string;
}
