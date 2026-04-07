import { Transform } from "class-transformer";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

import { CourierProfileBaseDto } from "./courier-profile-base.dto";

function normalizeRequiredString({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim() : value;
}

function normalizeEmail({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim().toLowerCase() : value;
}

export class RegisterCourierDto extends CourierProfileBaseDto {
  @Transform(normalizeRequiredString)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @Transform(normalizeEmail)
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(64)
  password!: string;

  @Transform(normalizeRequiredString)
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  phone!: string;
}
