import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPostalCode,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";

import { MAX_MONEY_AMOUNT } from "../../common/validation/money";
import { trimOptionalString } from "../../common/validation/text";
import { STOREFRONT_PAYMENT_METHODS, type StorefrontPaymentMethodInput } from "./storefront-checkout.dto";

const SAFE_TEXT_PATTERN = /^[^<>]*$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class StorefrontOpeningHourDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsBoolean()
  closed!: boolean;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @Matches(TIME_PATTERN)
  openTime?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @Matches(TIME_PATTERN)
  closeTime?: string;
}

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
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(160)
  @Matches(SAFE_TEXT_PATTERN)
  publicName?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(20)
  @Matches(/^[0-9()+\s-]+$/)
  publicPhone?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(120)
  @Matches(SAFE_TEXT_PATTERN)
  addressComplement?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(80)
  @Matches(SAFE_TEXT_PATTERN)
  addressCity?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(2)
  @Matches(/^[A-Za-z]{2}$/)
  addressState?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(12)
  @IsPostalCode("BR")
  addressZipCode?: string;

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
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  storefrontMinimumOrder?: number;

  @IsOptional()
  @IsArray()
  @IsIn(STOREFRONT_PAYMENT_METHODS, { each: true })
  storefrontPaymentMethods?: StorefrontPaymentMethodInput[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StorefrontOpeningHourDto)
  storefrontOpeningHours?: StorefrontOpeningHourDto[];

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
