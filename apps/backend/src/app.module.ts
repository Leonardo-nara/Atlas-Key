import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AuthModule } from "./auth/auth.module";
import { CouriersModule } from "./couriers/couriers.module";
import { HealthController } from "./health.controller";
import { OrdersModule } from "./orders/orders.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProductsModule } from "./products/products.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { StoreCourierLinksModule } from "./store-courier-links/store-courier-links.module";
import { StoresModule } from "./stores/stores.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"]
    }),
    PrismaModule,
    CouriersModule,
    AuthModule,
    UsersModule,
    StoresModule,
    StoreCourierLinksModule,
    RealtimeModule,
    ProductsModule,
    OrdersModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
