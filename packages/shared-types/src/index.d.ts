export type RuntimeStage = "development" | "staging" | "production";

export interface AppEnvironment {
  appName: "backend" | "desktop" | "mobile";
  stage: RuntimeStage;
  apiBaseUrl: string;
}

export interface HealthStatus {
  service: "backend" | "desktop" | "mobile";
  status: "ok";
  timestamp: string;
}

export type RealtimeOrderEventName =
  | "orders.created"
  | "orders.accepted"
  | "orders.status_updated"
  | "orders.cancelled";

export interface RealtimeOrderSnapshot {
  id: string;
  storeId: string;
  courierId?: string | null;
  status: string;
  statusLabel?: string;
  customerName: string;
  total: number;
  updatedAt: string;
}

export interface RealtimeOrderEventPayload {
  event: RealtimeOrderEventName;
  order: RealtimeOrderSnapshot;
  occurredAt: string;
}

export type StorefrontFulfillmentType = "DELIVERY" | "PICKUP";
export type StorefrontPaymentMethod =
  | "CASH"
  | "CARD_DEBIT_ON_DELIVERY"
  | "CARD_CREDIT_ON_DELIVERY"
  | "CARD_ON_DELIVERY"
  | "PIX_MANUAL"
  | "ONLINE";

export interface StorefrontOpeningHour {
  dayOfWeek: number;
  closed: boolean;
  openTime?: string;
  closeTime?: string;
}

export interface StorefrontPublicProduct {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  category: string;
  imageUrl?: string | null;
  available: boolean;
  featured?: boolean;
  availabilityLabel: string;
}

export interface StorefrontPublicStore {
  name: string;
  slug: string;
  address?: string;
  addressComplement?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZipCode?: string | null;
  phone?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  pickupEnabled: boolean;
  businessHoursNote?: string | null;
  minimumOrder?: number;
  openingHours?: StorefrontOpeningHour[];
  availability?: {
    openNow: boolean;
    orderAllowed: boolean;
    label: string;
    message: string;
  };
  estimatedWindow?: {
    preparationMinutes: number;
    deliveryMinMinutes: number;
    deliveryMaxMinutes: number;
  };
}

export interface StorefrontPublicCatalog {
  status: "OPEN" | "UNAVAILABLE";
  message?: string;
  store: StorefrontPublicStore;
  paymentOptions?: {
    methods: StorefrontPaymentMethod[];
    options?: Array<{
      value: StorefrontPaymentMethod;
      label: string;
      orderPaymentMethod: "CASH" | "CARD_ON_DELIVERY" | "PIX_MANUAL" | "ONLINE";
    }>;
  };
  deliveryZones?: Array<{ district: string; name: string; fee: number }>;
  categories?: string[];
  featuredProducts?: StorefrontPublicProduct[];
  products?: StorefrontPublicProduct[];
}
