import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min
} from "class-validator";

import { trimOptionalString } from "../../common/validation/text";

const SAFE_TEXT_PATTERN = /^[^<>]*$/;

export class UpdateStorefrontSettingsDto {
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(500)
  @Matches(SAFE_TEXT_PATTERN)
  publicDescription?: string;

  @IsOptional()
  @IsBoolean()
  storefrontEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  pickupEnabled?: boolean;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(240)
  @Matches(SAFE_TEXT_PATTERN)
  businessHoursNote?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(180)
  averagePreparationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  deliveryTimeMinMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(360)
  deliveryTimeMaxMinutes?: number;
}
