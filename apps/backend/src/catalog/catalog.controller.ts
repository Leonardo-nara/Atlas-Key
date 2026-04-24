import { Controller, Get, Param, Query } from "@nestjs/common";

import { CatalogService } from "./catalog.service";

@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get("stores")
  listStores(@Query("search") search?: string) {
    return this.catalogService.listStores(search);
  }

  @Get("stores/:storeId/products")
  listProductsByStore(
    @Param("storeId") storeId: string,
    @Query("search") search?: string
  ) {
    return this.catalogService.listProductsByStore(storeId, search);
  }
}
