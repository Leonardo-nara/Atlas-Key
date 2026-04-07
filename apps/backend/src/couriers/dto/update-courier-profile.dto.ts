import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

import { CourierProfileBaseDto } from "./courier-profile-base.dto";

function normalizeOptionalString({ value }: { value: unknown }) {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export class UpdateCourierProfileDto extends CourierProfileBaseDto {
  @IsOptional()
  @Transform(normalizeOptionalString)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Transform(normalizeOptionalString)
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  phone?: string;
}
