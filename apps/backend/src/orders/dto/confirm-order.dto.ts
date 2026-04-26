import { IsNumber, IsOptional, Min } from "class-validator";

export class ConfirmOrderDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  deliveryFee?: number;
}
