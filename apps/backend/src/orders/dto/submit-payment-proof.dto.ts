import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from "class-validator";

export class SubmitPaymentProofDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  payerName?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
