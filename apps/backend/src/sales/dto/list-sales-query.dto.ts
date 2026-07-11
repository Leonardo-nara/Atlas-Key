import { Transform, Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

import { trimOptionalString } from "../../common/validation/text";

export class ListSalesQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit: number = 10;

  @Transform(({ value }) =>
    typeof value === "string" ? value.toUpperCase() : value
  )
  @IsOptional()
  @IsIn(["DRAFT", "COMPLETED", "CANCELLED"])
  status?: "DRAFT" | "COMPLETED" | "CANCELLED";

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(120)
  search?: string;
}
