import { Transform } from "class-transformer";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength
} from "class-validator";

import { CourierVehicleType } from "@prisma/client";

function normalizeOptionalString({ value }: { value: unknown }) {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizePlate({ value }: { value: unknown }) {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : undefined;
}

export class CourierProfileBaseDto {
  @IsOptional()
  @Transform(normalizeOptionalString)
  @IsUrl({
    protocols: ["http", "https"],
    require_protocol: true
  })
  @MaxLength(500)
  profilePhotoUrl?: string;

  @IsOptional()
  @Transform(normalizeOptionalString)
  @IsUrl({
    protocols: ["http", "https"],
    require_protocol: true
  })
  @MaxLength(500)
  vehiclePhotoUrl?: string;

  @IsOptional()
  @IsEnum(CourierVehicleType)
  vehicleType?: CourierVehicleType;

  @IsOptional()
  @Transform(normalizeOptionalString)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  vehicleModel?: string;

  @IsOptional()
  @Transform(normalizePlate)
  @IsString()
  @MinLength(7)
  @MaxLength(10)
  plate?: string;

  @IsOptional()
  @Transform(normalizeOptionalString)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  city?: string;
}
