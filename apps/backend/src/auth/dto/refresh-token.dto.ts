import { Transform } from "class-transformer";
import { IsString, MaxLength, MinLength } from "class-validator";

import { trimString } from "../../common/validation/text";

export class RefreshTokenDto {
  @Transform(trimString)
  @IsString()
  @MinLength(32)
  @MaxLength(300)
  refreshToken!: string;
}
