import { Transform } from "class-transformer";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

function normalizeEmail({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim().toLowerCase() : value;
}

export class LoginDto {
  @Transform(normalizeEmail)
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;
}
