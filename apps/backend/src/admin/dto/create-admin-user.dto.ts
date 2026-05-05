import { Transform } from "class-transformer";
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from "class-validator";

import { UserRole } from "../../common/enums/user-role.enum";

function trimString({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim() : value;
}

function normalizeEmail({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim().toLowerCase() : value;
}

export class CreateAdminUserDto {
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(180)
  email!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password!: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsEnum(UserRole)
  role!: UserRole;
}
