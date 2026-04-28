CREATE TYPE "OrderPaymentMethod" AS ENUM ('CASH', 'CARD_ON_DELIVERY', 'PIX_MANUAL', 'ONLINE');

CREATE TYPE "OrderPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED');

CREATE TYPE "OrderPaymentProvider" AS ENUM ('MANUAL', 'FUTURE_GATEWAY');

ALTER TYPE "OrderEventType" ADD VALUE 'PAYMENT_PAID';

ALTER TABLE "orders"
ADD COLUMN "paymentMethod" "OrderPaymentMethod" NOT NULL DEFAULT 'CASH',
ADD COLUMN "paymentStatus" "OrderPaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "paymentProvider" "OrderPaymentProvider" DEFAULT 'MANUAL',
ADD COLUMN "paidAt" TIMESTAMP(3);
