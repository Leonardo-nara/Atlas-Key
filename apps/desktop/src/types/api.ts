export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "STORE_ADMIN" | "COURIER";
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  ownerUserId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  description?: string | null;
  price: number;
  category: string;
  imageUrl?: string | null;
  available: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId?: string | null;
  nameSnapshot: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  storeId: string;
  courierId?: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  status:
    | "PENDING"
    | "ACCEPTED"
    | "ASSIGNED"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "CANCELLED";
  notes?: string | null;
  cancelReason?: string | null;
  createdAt: string;
  updatedAt: string;
  statusLabel?: string;
  items: OrderItem[];
}

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

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface ApiErrorPayload {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}
