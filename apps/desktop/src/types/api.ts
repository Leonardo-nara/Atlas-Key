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
  lowStockProducts: number;
  outOfStockProducts: number;
}

export type StoreReadinessCategory = "REQUIRED" | "RECOMMENDED" | "OPTIONAL";

export interface StoreReadinessItem {
  key: string;
  label: string;
  description: string;
  category: StoreReadinessCategory;
  completed: boolean;
  actionLabel: string;
  route: string;
}

export interface StoreReadiness {
  storeId: string;
  storeName: string;
  ready: boolean;
  percentage: number;
  overallPercentage: number;
  completedRequiredItems: number;
  totalRequiredItems: number;
  completedItems: number;
  totalItems: number;
  generatedAt: string;
  items: StoreReadinessItem[];
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
  stockControlEnabled: boolean;
  stockQuantity: number;
  minimumStock: number;
  allowNegativeStock: boolean;
  stockUpdatedAt?: string | null;
  stockStatus?: "UNCONTROLLED" | "NORMAL" | "LOW" | "OUT";
  createdAt: string;
  updatedAt: string;
}

export type StockMovementType =
  | "INITIAL" | "PURCHASE_ENTRY" | "MANUAL_ENTRY" | "MANUAL_EXIT"
  | "INVENTORY_ADJUSTMENT" | "PDV_SALE" | "DELIVERY_RESERVED"
  | "DELIVERY_RELEASED" | "RETURN" | "CORRECTION";

export interface StockMovement {
  id: string;
  productId: string;
  type: StockMovementType;
  direction: "IN" | "OUT";
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  reason?: string | null;
  sourceReference?: string | null;
  createdAt: string;
  product?: { id: string; name: string };
  createdByUser?: { id: string; name: string } | null;
}

export interface StockSummary {
  controlledProducts: number;
  availableProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
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
  cashRegisterSessionId?: string | null;
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
  cashRegisterSession?: {
    id: string;
    status: "OPEN" | "CLOSED";
    openedAt: string;
    closedAt?: string | null;
    cashRegister: CashRegister;
  } | null;
  items: SaleItem[];
  payments: SalePayment[];
  events: SaleEvent[];
}

export interface SaleReceipt {
  notice: "DOCUMENTO SEM VALOR FISCAL";
  generatedAt: string;
  sale: Sale;
}

export type CashRegisterSessionStatus = "OPEN" | "CLOSED";
export type CashMovementType =
  | "OPENING"
  | "SALE"
  | "CASH_IN"
  | "CASH_OUT"
  | "REFUND"
  | "ADJUSTMENT"
  | "CLOSING_DIFFERENCE";

export interface CashRegisterSummarySession {
  id: string;
  status: CashRegisterSessionStatus;
  openingAmount: number;
  expectedCashAmount: number;
  openedAt: string;
  openedBy?: Pick<AuthUser, "id" | "name" | "email">;
}

export interface CashRegister {
  id: string;
  storeId: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  currentSession?: CashRegisterSummarySession | null;
}

export interface CashMovement {
  id: string;
  cashRegisterSessionId: string;
  storeId: string;
  userId: string;
  type: CashMovementType;
  amount: number;
  reason?: string | null;
  saleId?: string | null;
  createdAt: string;
  user?: Pick<AuthUser, "id" | "name" | "email">;
}

export interface CashRegisterSessionSummary {
  openingAmount: number;
  cashSales: number;
  cardSales: number;
  pixManualSales: number;
  pixAutomaticSales: number;
  totalSold: number;
  cashInTotal: number;
  cashOutTotal: number;
  expectedCashAmount: number;
  countedCashAmount?: number | null;
  differenceAmount?: number | null;
}

export interface CashRegisterSession {
  id: string;
  cashRegisterId: string;
  storeId: string;
  status: CashRegisterSessionStatus;
  openingAmount: number;
  expectedCashAmount: number;
  countedCashAmount?: number | null;
  differenceAmount?: number | null;
  openingNotes?: string | null;
  closingNotes?: string | null;
  openedAt: string;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  cashRegister: CashRegister;
  openedBy?: Pick<AuthUser, "id" | "name" | "email">;
  closedBy?: Pick<AuthUser, "id" | "name" | "email"> | null;
  summary: CashRegisterSessionSummary;
  movements: CashMovement[];
  sales: Array<{
    id: string;
    customerName?: string | null;
    status: SaleStatus;
    total: number;
    completedAt?: string | null;
    payments: SalePayment[];
    itemsCount: number;
    operator?: Pick<AuthUser, "id" | "name" | "email">;
  }>;
}

export interface CashRegisterSessionReport {
  session: CashRegisterSession;
  report: CashRegisterSessionSummary & {
    cashRegister: CashRegister;
    openedBy?: Pick<AuthUser, "id" | "name" | "email">;
    closedBy?: Pick<AuthUser, "id" | "name" | "email"> | null;
    openedAt: string;
    closedAt?: string | null;
    movements: CashMovement[];
  };
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

export type ReportPeriod = "today" | "yesterday" | "7d" | "30d" | "current_month" | "custom";

export interface ReportPeriodFilters {
  period?: ReportPeriod;
  dateFrom?: string;
  dateTo?: string;
}

export interface ReportListFilters extends ReportPeriodFilters {
  origin?: "DELIVERY" | "PDV";
  status?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ReportOverview {
  store: { id: string; name: string };
  period: { label: string; timezone: string; dateFrom: string; dateToExclusive: string };
  generatedAt: string;
  sales: {
    soldAmount: number;
    paidAmount: number;
    pendingAmount: number;
    cancelledAmount: number;
    rejectedAmount: number;
    realizedCount: number;
    averageTicket: number;
    deliverySoldAmount: number;
    pdvSoldAmount: number;
    cancelledCount: number;
    byPaymentMethod: Array<{ method: string; amount: number; count: number }>;
    paidByPaymentMethod: Array<{ method: string; amount: number; count: number }>;
  };
  operation: {
    deliveryOrdersCreated: number;
    deliveryOrdersInProgress: number;
    deliveryOrdersDelivered: number;
    deliveryOrdersCancelled: number;
    pdvSalesCompleted: number;
    pdvSalesCancelled: number;
    openCashRegisters: number;
    closedCashRegisters: number;
    closedCashDifferenceAmount: number;
  };
  stock: {
    controlledProducts: number;
    lowStockProducts: number;
    outOfStockProducts: number;
    topSellingProducts: Array<{ productId: string | null; name: string; quantitySold: number; soldAmount: number }>;
    topPhysicalOutputProducts: Array<{ productId: string; name: string; quantityMoved: number }>;
  };
}

export interface ReportSaleRow {
  id: string;
  friendlyId: string;
  origin: "DELIVERY" | "PDV";
  occurredAt: string;
  customerName?: string | null;
  soldAmount: number;
  paidAmount: number;
  status: string;
  paymentMethod?: string | null;
  paymentStatus: string;
  operator?: { id: string; name: string } | null;
  store: { id: string; name: string };
  cancelled: boolean;
  completed: boolean;
  estimated: boolean;
}

export interface ReportSalesResponse {
  items: ReportSaleRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ReportProductRow {
  product: { id: string; name: string; category: string };
  sku?: string | null;
  pdvQuantitySold: number;
  deliveryQuantitySold: number;
  totalQuantitySold: number;
  soldAmount: number;
  managerialRevenue: number;
  currentStock: number;
  minimumStock: number;
  stockStatus: "NO_CONTROL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  estimated: boolean;
}

export interface ReportProductsResponse {
  store: { id: string; name: string };
  period: ReportOverview["period"];
  items: ReportProductRow[];
}

export interface ReportCashRow {
  id: string;
  status: "OPEN" | "CLOSED";
  cashRegister: { id: string; name: string };
  openedBy?: { id: string; name: string } | null;
  closedBy?: { id: string; name: string } | null;
  openedAt: string;
  closedAt?: string | null;
  openingAmount: number;
  cashSalesAmount: number;
  cashInAmount: number;
  cashOutAmount: number;
  expectedCashAmount: number;
  countedCashAmount?: number | null;
  differenceAmount?: number | null;
  openingNotes?: string | null;
  closingNotes?: string | null;
}

export interface ReportCashResponse {
  items: ReportCashRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ReportStockRow {
  product: { id: string; name: string; category: string };
  stockControlEnabled: boolean;
  currentStock: number;
  minimumStock: number;
  stockStatus: "NO_CONTROL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  entries: number;
  outputs: number;
  adjustments: number;
  deliveryReservations: number;
  deliveryReleases: number;
  pdvOutputs: number;
  deliveryOutputs: number;
  netMovement: number;
}

export interface ReportStockResponse {
  items: ReportStockRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
