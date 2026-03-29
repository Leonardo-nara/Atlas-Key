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

export class CreateOrderItemDto {
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(40)
  productId?: string;

  @ValidateIf((dto: CreateOrderItemDto) => !dto.productId)
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
  unitPrice?: number;
}
