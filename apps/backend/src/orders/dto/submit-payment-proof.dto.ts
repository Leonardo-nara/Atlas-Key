import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { Transform } from "class-transformer";

import { MAX_MONEY_AMOUNT } from "../../common/validation/money";
import { trimOptionalString } from "../../common/validation/text";

export class SubmitPaymentProofDto {
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(160)
  payerName?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  amount?: number;

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
