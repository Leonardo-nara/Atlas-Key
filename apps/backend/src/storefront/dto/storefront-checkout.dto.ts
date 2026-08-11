import { Transform, Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";

import { MAX_MONEY_AMOUNT } from "../../common/validation/money";
import { trimOptionalString, trimString } from "../../common/validation/text";
import { ClientOrderFulfillmentInput } from "../../orders/dto/create-client-order.dto";

const SAFE_TEXT_PATTERN = /^[^<>]*$/;
export const STOREFRONT_PAYMENT_METHODS = [
  "CASH",
  "CARD_DEBIT_ON_DELIVERY",
  "CARD_CREDIT_ON_DELIVERY",
  "PIX_MANUAL",
  "ONLINE"
] as const;

export type StorefrontPaymentMethodInput =
  (typeof STOREFRONT_PAYMENT_METHODS)[number];

export class StorefrontCheckoutItemDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(240)
  @Matches(SAFE_TEXT_PATTERN)
  notes?: string;
}

export class StorefrontCheckoutDto {
  @Transform(trimString)
  @IsString()
  @MinLength(12)
  @MaxLength(120)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  idempotencyKey!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Matches(SAFE_TEXT_PATTERN)
  customerName!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  @Matches(/^[0-9()+\s-]+$/)
  customerPhone!: string;

  @IsEnum(ClientOrderFulfillmentInput)
  fulfillmentType!: ClientOrderFulfillmentInput;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(12)
  @Matches(/^[0-9-]+$/)
  addressZipCode?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(120)
  @Matches(SAFE_TEXT_PATTERN)
  addressStreet?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(20)
  @Matches(SAFE_TEXT_PATTERN)
  addressNumber?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(80)
  @Matches(SAFE_TEXT_PATTERN)
  addressDistrict?: string;

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
  @MaxLength(160)
  @Matches(SAFE_TEXT_PATTERN)
  addressReference?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(500)
  @Matches(SAFE_TEXT_PATTERN)
  notes?: string;

  @IsIn(STOREFRONT_PAYMENT_METHODS)
  paymentMethod!: StorefrontPaymentMethodInput;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  cashChangeFor?: number;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(20)
  @Matches(/^[0-9.\-/]+$/)
  payerDocument?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StorefrontCheckoutItemDto)
  items!: StorefrontCheckoutItemDto[];
}
