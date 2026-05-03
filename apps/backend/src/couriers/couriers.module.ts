import { Module } from "@nestjs/common";

import { CourierMediaController, CouriersController } from "./couriers.controller";
import { CouriersService } from "./couriers.service";

@Module({
  controllers: [CouriersController, CourierMediaController],
  providers: [CouriersService],
  exports: [CouriersService]
})
export class CouriersModule {}
