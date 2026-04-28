import { Transform } from "class-transformer";
import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

function normalizeString({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim() : value;
}

export class CreateDeliveryZoneDto {
  @Transform(normalizeString)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @Transform(normalizeString)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  district!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fee!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
