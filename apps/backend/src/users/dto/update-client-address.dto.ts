import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

function normalizeString({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim() : value;
}

function normalizeOptionalString({ value }: { value: unknown }) {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export class UpdateClientAddressDto {
  @Transform(normalizeString)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  street!: string;

  @Transform(normalizeString)
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  number!: string;

  @Transform(normalizeString)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  district!: string;

  @IsOptional()
  @Transform(normalizeOptionalString)
  @IsString()
  @MaxLength(120)
  complement?: string;

  @Transform(normalizeString)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city!: string;

  @IsOptional()
  @Transform(normalizeOptionalString)
  @IsString()
  @MaxLength(160)
  reference?: string;
}
