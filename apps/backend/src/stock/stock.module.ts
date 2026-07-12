import { Module } from "@nestjs/common";
import { StoresModule } from "../stores/stores.module";
import { StockController } from "./stock.controller";
import { StockService } from "./stock.service";

@Module({
  imports: [StoresModule],
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService]
})
export class StockModule {}
