import { Module } from "@nestjs/common";

import { RealtimeModule } from "../realtime/realtime.module";
import { StoresModule } from "../stores/stores.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [StoresModule, RealtimeModule],
  controllers: [OrdersController],
  providers: [OrdersService]
})
export class OrdersModule {}
