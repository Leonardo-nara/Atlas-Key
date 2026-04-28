export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "STORE_ADMIN" | "COURIER" | "CLIENT";
  active: boolean;
  profileCompleted?: boolean;
  courierProfile?: CourierProfile | null;
  clientAddress?: ClientAddress | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientAddress {
  id: string;
  street: string;
  number: string;
  district: string;
  complement?: string | null;
  city: string;
  reference?: string | null;
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

export type StorePixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM_KEY";

export type ClientCatalogStore = Store;

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

export interface StoreCatalogResponse {
  store: Store;
  products: Product[];
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

export interface AuthSession {
  id: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  expiresAt: string;
  lastUsedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  current: boolean;
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

export type OrderPaymentMethod =
  | "CASH"
  | "CARD_ON_DELIVERY"
  | "PIX_MANUAL"
  | "ONLINE";

export type OrderPaymentStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED";

export type OrderPaymentProvider = "MANUAL" | "FUTURE_GATEWAY";

export interface OrderCourier {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface OrderPixPaymentInstructions {
  pixKeyType: StorePixKeyType;
  pixKey: string;
  pixRecipientName: string;
  pixInstructions: string;
}

export interface Order {
  id: string;
  storeId: string;
  courierId?: string | null;
  clientId?: string | null;
  fulfillmentType?: "DELIVERY" | "PICKUP";
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressDistrict?: string | null;
  addressComplement?: string | null;
  addressCity?: string | null;
  addressReference?: string | null;
  subtotal: number;
  suggestedDeliveryFee?: number | null;
  deliveryFee: number;
  total: number;
  paymentMethod: OrderPaymentMethod;
  paymentStatus: OrderPaymentStatus;
  paymentProvider?: OrderPaymentProvider | null;
  paidAt?: string | null;
  pixPaymentInstructions?: OrderPixPaymentInstructions | null;
  status: string;
  statusLabel?: string;
  notes?: string | null;
  cancelReason?: string | null;
  storeConfirmedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  store?: OrderStore;
  courier?: OrderCourier | null;
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
