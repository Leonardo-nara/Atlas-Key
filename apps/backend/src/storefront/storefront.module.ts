import { Module } from "@nestjs/common";

import { OrdersModule } from "../orders/orders.module";
import { RealtimeModule } from "../realtime/realtime.module";
import { StockModule } from "../stock/stock.module";
import { StoresModule } from "../stores/stores.module";
import {
  StorefrontAdminController,
  StorefrontController
} from "./storefront.controller";
import { StorefrontService } from "./storefront.service";

@Module({
  imports: [StoresModule, StockModule, RealtimeModule, OrdersModule],
  controllers: [StorefrontController, StorefrontAdminController],
  providers: [StorefrontService]
})
export class StorefrontModule {}
