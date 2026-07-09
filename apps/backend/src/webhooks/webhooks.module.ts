import { Module } from "@nestjs/common";

import { OrdersModule } from "../orders/orders.module";
import { PaymentWebhooksController } from "./payment-webhooks.controller";

@Module({
  imports: [OrdersModule],
  controllers: [PaymentWebhooksController]
})
export class WebhooksModule {}
