import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { SentryModule } from "@sentry/nestjs/setup";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { AuthModule } from "./auth/auth.module";
import { CouriersModule } from "./couriers/couriers.module";
import { HealthController } from "./health.controller";
import { InternalMetricsController } from "./common/observability/internal-metrics.controller";
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
    SentryModule.forRoot(),
    ThrottlerModule.forRoot({
      errorMessage: "Muitas requisicoes. Aguarde alguns instantes e tente novamente.",
      throttlers: [
        {
          name: "default",
          ttl: 60_000,
          limit: 120
        }
      ]
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
  controllers: [HealthController, InternalMetricsController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule {}
