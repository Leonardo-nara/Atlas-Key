import { Module } from "@nestjs/common";

import { StoresModule } from "../stores/stores.module";
import { StockModule } from "../stock/stock.module";
import { SalesController } from "./sales.controller";
import { SalesService } from "./sales.service";

@Module({
  imports: [StoresModule, StockModule],
  controllers: [SalesController],
  providers: [SalesService]
})
export class SalesModule {}
