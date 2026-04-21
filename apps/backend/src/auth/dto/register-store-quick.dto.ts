import { Transform } from "class-transformer";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

function normalizeString({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim() : value;
}

function normalizeEmail({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim().toLowerCase() : value;
}

export class RegisterStoreQuickDto {
  @Transform(normalizeString)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  storeName!: string;

  @Transform(normalizeString)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  ownerName!: string;

  @Transform(normalizeEmail)
  @IsEmail()
  email!: string;

  @Transform(normalizeString)
  @IsString()
  @MinLength(6)
  @MaxLength(64)
  password!: string;
}
