import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

import { trimOptionalString } from "../../common/validation/text";

export class UpdateCashRegisterDto {
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
