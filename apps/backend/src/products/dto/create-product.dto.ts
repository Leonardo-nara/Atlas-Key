import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate
} from "class-validator";
import { Transform } from "class-transformer";
import { MAX_MONEY_AMOUNT } from "../../common/validation/money";
import { trimOptionalString, trimString } from "../../common/validation/text";
import { ImageReferenceConstraint } from "../../common/validation/image-reference.validator";

export class CreateProductDto {
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  price!: number;

  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  category!: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @Validate(ImageReferenceConstraint)
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  available?: boolean;
}
