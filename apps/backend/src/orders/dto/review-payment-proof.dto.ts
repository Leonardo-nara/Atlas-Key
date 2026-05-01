import { IsOptional, IsString, MaxLength } from "class-validator";

export class ReviewPaymentProofDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
