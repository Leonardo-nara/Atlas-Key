import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";
import { OrderPaymentMethod } from "@prisma/client";

import { CreateClientOrderItemDto } from "./create-client-order-item.dto";

export enum ClientOrderFulfillmentInput {
  DELIVERY = "DELIVERY",
  PICKUP = "PICKUP"
}

export class CreateClientOrderDto {
  @IsString()
  @MinLength(10)
  @MaxLength(40)
  storeId!: string;

  @IsEnum(ClientOrderFulfillmentInput)
  fulfillmentType!: ClientOrderFulfillmentInput;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  customerAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  addressStreet?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  addressNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  addressDistrict?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  addressComplement?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  addressCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  addressReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsEnum(OrderPaymentMethod)
  paymentMethod?: OrderPaymentMethod;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateClientOrderItemDto)
  items!: CreateClientOrderItemDto[];
}
