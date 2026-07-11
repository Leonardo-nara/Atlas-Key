import { IsInt, IsNumber, IsOptional, Max, Min } from "class-validator";

import { MAX_MONEY_AMOUNT } from "../../common/validation/money";

export class UpdateSaleItemDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  quantity?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  discountAmount?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  surchargeAmount?: number;
}
