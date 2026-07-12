import { IsBoolean, IsNumber, IsOptional, Max, Min } from "class-validator";

const MAX_STOCK = 999999999;

export class UpdateStockSettingsDto {
  @IsBoolean()
  stockControlEnabled!: boolean;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(MAX_STOCK)
  minimumStock!: number;

  @IsBoolean()
  allowNegativeStock!: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(MAX_STOCK)
  initialQuantity?: number;
}
