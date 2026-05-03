import { Module } from "@nestjs/common";

import { StoreMediaController, StoresController } from "./stores.controller";
import { StoresService } from "./stores.service";

@Module({
  controllers: [StoresController, StoreMediaController],
  providers: [StoresService],
  exports: [StoresService]
})
export class StoresModule {}
