import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";

import { CreateClientOrderItemDto } from "./create-client-order-item.dto";

export class CreateClientOrderDto {
  @IsString()
  @MinLength(10)
  @MaxLength(40)
  storeId!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(240)
  customerAddress!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateClientOrderItemDto)
  items!: CreateClientOrderItemDto[];
}
