import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength } from "class-validator";

import { trimOptionalString } from "../../common/validation/text";

export class ReviewPaymentProofDto {
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(300)
  reason?: string;
}
