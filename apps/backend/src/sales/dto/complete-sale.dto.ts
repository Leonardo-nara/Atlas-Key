import { Type } from "class-transformer";
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
  ValidateNested
} from "class-validator";
import { SalePaymentMethod } from "@prisma/client";

import { MAX_MONEY_AMOUNT } from "../../common/validation/money";

export class CompleteSalePaymentDto {
  @IsEnum(SalePaymentMethod)
  method!: SalePaymentMethod;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_MONEY_AMOUNT)
  amount!: number;
}

export class CompleteSaleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CompleteSalePaymentDto)
  payments!: CompleteSalePaymentDto[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  idempotencyKey?: string;
}
