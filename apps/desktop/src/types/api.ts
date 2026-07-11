export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "PLATFORM_ADMIN" | "STORE_ADMIN" | "COURIER" | "CLIENT";
  status?: "ACTIVE" | "SUSPENDED" | "INACTIVE";
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CourierVehicleType = "MOTO" | "SCOOTER" | "BICICLETA" | "CARRO";

export interface CourierProfile {
  id: string;
  profilePhotoUrl?: string | null;
  profileImageFileName?: string | null;
  profileImageMimeType?: string | null;
  profileImageSize?: number | null;
  profileImageUpdatedAt?: string | null;
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
  status?: "ACTIVE" | "SUSPENDED" | "INACTIVE";
  imageUrl?: string | null;
  profileImageFileName?: string | null;
  profileImageMimeType?: string | null;
  profileImageSize?: number | null;
  profileImageUpdatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoreDashboard {
  storeId: string;
  storeName: string;
  generatedAt: string;
  ordersToday: number;
  pendingOrders: number;
  inProgressOrders: number;
  deliveredToday: number;
  estimatedRevenueToday: number;
  pendingPayments: number;
  activeProducts: number;
  activeCouriers: number;
}

export interface AdminDashboardRecentStore {
  id: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED" | "INACTIVE";
  active: boolean;
  createdAt: string;
  owner?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface AdminDashboard {
  generatedAt: string;
  activeStores: number;
  suspendedStores: number;
  inactiveStores: number;
  activeUsers: number;
  activeCouriers: number;
  ordersToday: number;
  totalOrders: number;
  pendingPayments: number;
  recentStores: AdminDashboardRecentStore[];
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
  imageFileName?: string | null;
  imageMimeType?: string | null;
  imageSize?: number | null;
  imageUpdatedAt?: string | null;
  available: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SaleStatus = "DRAFT" | "COMPLETED" | "CANCELLED";
export type SalePaymentMethod = "CASH" | "CARD" | "PIX_MANUAL" | "PIX_AUTOMATIC";
export type SalePaymentStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED";

export interface SaleItem {
  id: string;
  saleId: string;
  productId?: string | null;
  productNameSnapshot: string;
  unitPrice: number;
  quantity: number;
  discountAmount: number;
  surchargeAmount: number;
  total: number;
  createdAt: string;
}

export interface SalePayment {
  id: string;
  saleId: string;
  method: SalePaymentMethod;
  amount: number;
  status: SalePaymentStatus;
  provider?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

export interface SaleEvent {
  id: string;
  saleId: string;
  type:
    | "sale_created"
    | "sale_completed"
    | "sale_cancelled"
    | "sale_discount_applied";
  actorUserId?: string | null;
  actorRole?: AuthUser["role"] | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  actorUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface Sale {
  id: string;
  storeId: string;
  operatorUserId: string;
  customerName?: string | null;
  customerDocument?: string | null;
  status: SaleStatus;
  subtotal: number;
  discountAmount: number;
  surchargeAmount: number;
  total: number;
  paymentStatus: SalePaymentStatus;
  notes?: string | null;
  cancelReason?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  store?: Pick<Store, "id" | "name" | "address">;
  operator?: Pick<AuthUser, "id" | "name" | "email">;
  items: SaleItem[];
  payments: SalePayment[];
  events: SaleEvent[];
}

export interface SaleReceipt {
  notice: "DOCUMENTO SEM VALOR FISCAL";
  generatedAt: string;
  sale: Sale;
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

export type AutomaticPixPaymentStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED"
  | "REFUNDED";

export interface OrderAutomaticPixPayment {
  status: AutomaticPixPaymentStatus;
  amount: number;
  currency: "BRL";
  qrCodeText?: string | null;
  qrCodeImageUrl?: string | null;
  expiresAt?: string | null;
  paidAt?: string | null;
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
  automaticPixPayment?: OrderAutomaticPixPayment | null;
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

export type OperationalStatus = "ACTIVE" | "SUSPENDED" | "INACTIVE";

export interface AdminStore extends Store {
  status: OperationalStatus;
  owner?: AuthUser;
  lastOrderAt?: string | null;
  _count?: {
    products?: number;
    orders?: number;
    courierLinks?: number;
    deliveryZones?: number;
  };
}

export interface AdminUser extends AuthUser {
  status: OperationalStatus;
  ownedStore?: {
    id: string;
    name: string;
    status: OperationalStatus;
    active: boolean;
  } | null;
  courierProfile?: Partial<CourierProfile> | null;
  storeLinks?: Array<{
    id: string;
    status: StoreCourierLinkStatus;
    requestedBy: StoreCourierLinkRequestedBy;
    approvedAt?: string | null;
    rejectedAt?: string | null;
    store: {
      id: string;
      name: string;
      status: OperationalStatus;
      active: boolean;
    };
  }>;
}

export type AdminCourier = AdminUser;

export interface AdminAuditLog {
  id: string;
  adminUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string | null;
  metadataJson?: Record<string, unknown> | null;
  createdAt: string;
  adminUser?: {
    id: string;
    name: string;
    email: string;
    role: AuthUser["role"];
  };
}
