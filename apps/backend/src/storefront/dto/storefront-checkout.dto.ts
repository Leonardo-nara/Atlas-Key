import { Transform, Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested
} from "class-validator";
import { OrderPaymentMethod } from "@prisma/client";

import { trimOptionalString, trimString } from "../../common/validation/text";
import { CreateClientOrderItemDto } from "../../orders/dto/create-client-order-item.dto";
import { ClientOrderFulfillmentInput } from "../../orders/dto/create-client-order.dto";

const SAFE_TEXT_PATTERN = /^[^<>]*$/;

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

  @IsEnum(OrderPaymentMethod)
  paymentMethod!: OrderPaymentMethod;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(20)
  @Matches(/^[0-9.\-/]+$/)
  payerDocument?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateClientOrderItemDto)
  items!: CreateClientOrderItemDto[];
}
