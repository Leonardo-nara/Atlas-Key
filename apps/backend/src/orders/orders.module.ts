import { Module } from "@nestjs/common";

import { RealtimeModule } from "../realtime/realtime.module";
import { StoresModule } from "../stores/stores.module";
import { StockModule } from "../stock/stock.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { PaymentGatewayService } from "./payment-gateway.service";
import { PaymentProofStorageService } from "./payment-proof-storage.service";

@Module({
  imports: [StoresModule, RealtimeModule, StockModule],
  controllers: [OrdersController],
  providers: [OrdersService, PaymentProofStorageService, PaymentGatewayService],
  exports: [PaymentGatewayService]
})
export class OrdersModule {}
