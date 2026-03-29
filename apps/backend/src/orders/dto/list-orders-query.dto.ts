import { Transform, Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min
} from "class-validator";

export class ListOrdersQueryDto {
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
    typeof value === "string" ? value.toLowerCase() : value
  )
  @IsOptional()
  @IsIn(["pending", "accepted", "picked_up", "delivered", "cancelled"])
  status?: "pending" | "accepted" | "picked_up" | "delivered" | "cancelled";

  @Transform(({ value }) =>
    typeof value === "string" ? value.toLowerCase() : value
  )
  @IsOptional()
  @IsIn(["active", "completed", "all"])
  scope?: "active" | "completed" | "all";
}
