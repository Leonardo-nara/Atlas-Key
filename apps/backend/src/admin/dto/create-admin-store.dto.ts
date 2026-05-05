import { Transform } from "class-transformer";
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from "class-validator";

function trimString({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim() : value;
}

function normalizeEmail({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim().toLowerCase() : value;
}

export class CreateAdminStoreDto {
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  storeName!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(5)
  @MaxLength(240)
  storeAddress!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  ownerName!: string;

  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(180)
  ownerEmail!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  ownerPassword!: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  ownerPhone?: string;
}
