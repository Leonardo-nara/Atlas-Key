import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";
import { Transform } from "class-transformer";

import { MAX_MONEY_AMOUNT } from "../../common/validation/money";
import { trimString } from "../../common/validation/text";

export class AddSaleItemDto {
  @Transform(trimString)
  @IsString()
  @MinLength(10)
  @MaxLength(40)
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  unitPrice?: number;
}
