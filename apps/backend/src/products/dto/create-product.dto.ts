import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  Validate
} from "class-validator";
import { ImageReferenceConstraint } from "../../common/validation/image-reference.validator";

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  category!: string;

  @IsOptional()
  @Validate(ImageReferenceConstraint)
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  available?: boolean;
}
