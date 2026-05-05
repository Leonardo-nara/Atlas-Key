import { StoreStatus } from "@prisma/client";
import { IsEnum } from "class-validator";

export class UpdateAdminStoreStatusDto {
  @IsEnum(StoreStatus)
  status!: StoreStatus;
}
