import { Module } from "@nestjs/common";

import { StoresModule } from "../stores/stores.module";
import { ProductMediaController, ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

@Module({
  imports: [StoresModule],
  controllers: [ProductsController, ProductMediaController],
  providers: [ProductsService]
})
export class ProductsModule {}
