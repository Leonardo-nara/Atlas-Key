import { UserStatus } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

function trimString({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim() : value;
}

export class UpdateAdminUserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}
