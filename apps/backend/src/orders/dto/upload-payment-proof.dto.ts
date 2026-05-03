import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength } from "class-validator";

import { trimOptionalString } from "../../common/validation/text";

export class UploadPaymentProofDto {
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(120)
  payerName?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(20)
  amount?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(160)
  reference?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(500)
  notes?: string;
}
