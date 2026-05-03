import { Transform } from "class-transformer";
import { IsString, MaxLength, MinLength } from "class-validator";

import { trimString } from "../../common/validation/text";

export class RequestStoreLinkDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  storeId!: string;
}
