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

export interface OrderItem {
  id: string;
  orderId: string;
  productId?: string | null;
  nameSnapshot: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderStore {
  id: string;
  name: string;
  address: string;
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
  status: string;
  statusLabel?: string;
  notes?: string | null;
  cancelReason?: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  store?: OrderStore;
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
