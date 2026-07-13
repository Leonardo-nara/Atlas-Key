import { Transform } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export enum ReportPeriod {
  TODAY = "today",
  YESTERDAY = "yesterday",
  SEVEN_DAYS = "7d",
  THIRTY_DAYS = "30d",
  CURRENT_MONTH = "current_month",
  CUSTOM = "custom"
}

export enum ReportOrigin {
  DELIVERY = "DELIVERY",
  PDV = "PDV"
}

export class ReportPeriodQueryDto {
  @IsOptional()
  @IsEnum(ReportPeriod)
  period?: ReportPeriod;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  dateFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  dateTo?: string;
}

export class ReportListQueryDto extends ReportPeriodQueryDto {
  @IsOptional()
  @IsEnum(ReportOrigin)
  origin?: ReportOrigin;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  paymentStatus?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
