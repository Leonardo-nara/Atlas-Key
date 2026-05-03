import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { OrderPaymentMethod } from "@prisma/client";

import { MAX_MONEY_AMOUNT } from "../../common/validation/money";
import { trimOptionalString, trimString } from "../../common/validation/text";
import { CreateOrderItemDto } from "./create-order-item.dto";

export class CreateOrderDto {
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  customerName!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  customerPhone!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(5)
  @MaxLength(240)
  customerAddress!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  deliveryFee!: number;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsEnum(OrderPaymentMethod)
  paymentMethod?: OrderPaymentMethod;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}
