import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { OrdersRealtimeGateway } from "./orders-realtime.gateway";
import { OrdersRealtimeService } from "./orders-realtime.service";

@Module({
  imports: [AuthModule, PrismaModule],
  providers: [OrdersRealtimeGateway, OrdersRealtimeService],
  exports: [OrdersRealtimeService]
})
export class RealtimeModule {}
