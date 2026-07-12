import { Transform } from "class-transformer";
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

import { MAX_MONEY_AMOUNT } from "../../common/validation/money";
import { trimOptionalString } from "../../common/validation/text";

export class OpenCashRegisterDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  openingAmount!: number;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(500)
  notes?: string;
}
