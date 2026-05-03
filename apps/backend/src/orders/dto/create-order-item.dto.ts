import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf
} from "class-validator";
import { Transform } from "class-transformer";

import { MAX_MONEY_AMOUNT } from "../../common/validation/money";
import { trimOptionalString } from "../../common/validation/text";

export class CreateOrderItemDto {
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MinLength(10)
  @MaxLength(40)
  productId?: string;

  @ValidateIf((dto: CreateOrderItemDto) => !dto.productId)
  @Transform(trimOptionalString)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  nameSnapshot?: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;

  @ValidateIf((dto: CreateOrderItemDto) => !dto.productId)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  unitPrice?: number;
}
