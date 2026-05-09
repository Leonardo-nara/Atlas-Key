import { Transform } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";

function trimString({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim() : value;
}

export class ListAdminAuditLogsQueryDto {
  @Transform(({ value }) => Number(value))
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @Transform(({ value }) => Number(value))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  action?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  targetType?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  adminUserId?: string;
}
