import { IsNumber, IsOptional, Max, Min } from "class-validator";

import { MAX_MONEY_AMOUNT } from "../../common/validation/money";

export class ConfirmOrderDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  deliveryFee?: number;
}
