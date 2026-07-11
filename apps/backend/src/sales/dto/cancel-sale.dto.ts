import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength } from "class-validator";

import { trimOptionalString } from "../../common/validation/text";

export class CancelSaleDto {
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(300)
  reason?: string;
}
