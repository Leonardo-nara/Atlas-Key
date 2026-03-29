export const ORDER_SOCKET_EVENTS = {
  CREATED: "orders.created",
  ACCEPTED: "orders.accepted",
  STATUS_UPDATED: "orders.status_updated",
  CANCELLED: "orders.cancelled"
} as const;

export function storeRoom(storeId: string) {
  return `store:${storeId}`;
}

export function courierRoom(courierId: string) {
  return `courier:${courierId}`;
}

export function availableOrdersRoom() {
  return "orders:available";
}
