import { Transform } from "class-transformer";
import { IsNumber, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

import { MAX_MONEY_AMOUNT } from "../../common/validation/money";
import { trimString } from "../../common/validation/text";

export class CashMovementDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_MONEY_AMOUNT)
  amount!: number;

  @Transform(trimString)
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason!: string;
}
