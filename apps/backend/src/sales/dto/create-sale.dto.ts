import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength } from "class-validator";

import { trimOptionalString } from "../../common/validation/text";

export class CreateSaleDto {
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(160)
  customerName?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(40)
  customerDocument?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(500)
  notes?: string;
}
