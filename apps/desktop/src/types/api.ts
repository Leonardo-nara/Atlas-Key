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

export interface Store {
  id: string;
  name: string;
  address: string;
  ownerUserId?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoreDeliveryZone {
  id: string;
  storeId: string;
  name: string;
  district: string;
  districtNormalized: string;
  fee: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type StorePixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM_KEY";

export interface StorePixSettings {
  storeId: string;
  pixKeyType?: StorePixKeyType | null;
  pixKey?: string | null;
  pixRecipientName?: string | null;
  pixInstructions?: string | null;
  pixEnabled: boolean;
  updatedAt: string;
}

export type StoreCourierLinkStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "BLOCKED";

export type StoreCourierLinkRequestedBy = "COURIER" | "STORE_ADMIN";

export interface CourierSummary {
  id: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  profileCompleted?: boolean;
  courierProfile?: CourierProfile | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoreCourierLink {
  id: string;
  status: StoreCourierLinkStatus;
  requestedBy: StoreCourierLinkRequestedBy;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  store: Store;
  courier: CourierSummary;
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

export type OrderPaymentProofStatus =
  | "NOT_SUBMITTED"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED";

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
  paymentProofStatus?: OrderPaymentProofStatus;
  paymentProofSubmittedAt?: string | null;
  paymentProofPayerName?: string | null;
  paymentProofAmount?: number | null;
  paymentProofReference?: string | null;
  paymentProofNotes?: string | null;
  paymentProofFileUrl?: string | null;
  paymentProofFileName?: string | null;
  paymentProofFileMimeType?: string | null;
  paymentProofFileSize?: number | null;
  paymentProofUploadedAt?: string | null;
  pixPaymentInstructions?: OrderPixPaymentInstructions | null;
  status:
    | "PENDING"
    | "ACCEPTED"
    | "ASSIGNED"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "CANCELLED";
  notes?: string | null;
  cancelReason?: string | null;
  storeConfirmedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  statusLabel?: string;
  items: OrderItem[];
  courier?: OrderCourier | null;
}

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
