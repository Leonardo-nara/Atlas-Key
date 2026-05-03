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
import { Transform, Type } from "class-transformer";
import { OrderPaymentMethod } from "@prisma/client";

import { trimOptionalString, trimString } from "../../common/validation/text";
import { CreateClientOrderItemDto } from "./create-client-order-item.dto";

export enum ClientOrderFulfillmentInput {
  DELIVERY = "DELIVERY",
  PICKUP = "PICKUP"
}

export class CreateClientOrderDto {
  @Transform(trimString)
  @IsString()
  @MinLength(10)
  @MaxLength(40)
  storeId!: string;

  @IsEnum(ClientOrderFulfillmentInput)
  fulfillmentType!: ClientOrderFulfillmentInput;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(240)
  customerAddress?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(120)
  addressStreet?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(20)
  addressNumber?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(80)
  addressDistrict?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(120)
  addressComplement?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(80)
  addressCity?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(160)
  addressReference?: string;

  @IsOptional()
  @Transform(trimOptionalString)
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
