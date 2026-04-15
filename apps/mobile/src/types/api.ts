export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "STORE_ADMIN" | "COURIER";
  active: boolean;
  profileCompleted?: boolean;
  courierProfile?: CourierProfile | null;
  createdAt: string;
  updatedAt: string;
}

export type CourierVehicleType = "MOTO" | "SCOOTER" | "BICICLETA" | "CARRO";

export interface CourierProfile {
  id: string;
  profilePhotoUrl?: string | null;
  vehiclePhotoUrl?: string | null;
  vehicleType?: CourierVehicleType | null;
  vehicleModel?: string | null;
  plate?: string | null;
  city?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type StoreCourierLinkStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "BLOCKED";

export type StoreCourierLinkRequestedBy = "COURIER" | "STORE_ADMIN";

export interface StoreCourierLink {
  id: string;
  status: StoreCourierLinkStatus;
  requestedBy: StoreCourierLinkRequestedBy;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  store: Store;
  courier: AuthUser;
}

export interface StoreDiscoveryItem extends Store {
  link?: {
    id: string;
    status: StoreCourierLinkStatus;
    requestedBy: StoreCourierLinkRequestedBy;
    approvedAt?: string | null;
    rejectedAt?: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
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
