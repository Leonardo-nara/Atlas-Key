import { Transform } from "class-transformer";
import { IsString, MaxLength, MinLength } from "class-validator";

import { trimString } from "../../common/validation/text";

export class CreateCashRegisterDto {
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
}
