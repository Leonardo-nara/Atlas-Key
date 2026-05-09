import { StoreStatus } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

function trimString({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim() : value;
}

export class UpdateAdminStoreStatusDto {
  @IsEnum(StoreStatus)
  status!: StoreStatus;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}
