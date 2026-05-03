import {
  IsEmail,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf
} from "class-validator";
import { Transform } from "class-transformer";

import { UserRole } from "../../common/enums/user-role.enum";

function normalizeString({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim() : value;
}

function normalizeEmail({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim().toLowerCase() : value;
}

export class RegisterDto {
  @Transform(normalizeString)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @Transform(normalizeEmail)
  @IsEmail()
  email!: string;

  @Transform(normalizeString)
  @IsString()
  @MinLength(6)
  @MaxLength(64)
  password!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(20)
  @Transform(normalizeString)
  phone!: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @Transform(normalizeString)
  @ValidateIf((dto: RegisterDto) => dto.role === UserRole.STORE_ADMIN)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  storeName?: string;

  @Transform(normalizeString)
  @ValidateIf((dto: RegisterDto) => dto.role === UserRole.STORE_ADMIN)
  @IsString()
  @MinLength(5)
  @MaxLength(240)
  storeAddress?: string;
}
