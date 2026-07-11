import { Module } from "@nestjs/common";

import { StoresModule } from "../stores/stores.module";
import { SalesController } from "./sales.controller";
import { SalesService } from "./sales.service";

@Module({
  imports: [StoresModule],
  controllers: [SalesController],
  providers: [SalesService]
})
export class SalesModule {}
