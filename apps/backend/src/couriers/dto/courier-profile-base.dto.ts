import { Transform } from "class-transformer";
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Validate
} from "class-validator";

import { CourierVehicleType } from "@prisma/client";
import { ImageReferenceConstraint } from "../../common/validation/image-reference.validator";

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
  @Validate(ImageReferenceConstraint)
  profilePhotoUrl?: string;

  @IsOptional()
  @Transform(normalizeOptionalString)
  @Validate(ImageReferenceConstraint)
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
