import { Module } from "@nestjs/common";

import { StoresModule } from "../stores/stores.module";
import { StoreCourierLinksController } from "./store-courier-links.controller";
import { StoreCourierLinksService } from "./store-courier-links.service";

@Module({
  imports: [StoresModule],
  controllers: [StoreCourierLinksController],
  providers: [StoreCourierLinksService],
  exports: [StoreCourierLinksService]
})
export class StoreCourierLinksModule {}
