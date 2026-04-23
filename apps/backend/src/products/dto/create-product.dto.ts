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
import {
  ValidatorConstraint,
  ValidatorConstraintInterface
} from "class-validator";

const PRODUCT_IMAGE_DATA_URL_PATTERN =
  /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i;

@ValidatorConstraint({ name: "productImageReference", async: false })
class ProductImageReferenceConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    if (value === undefined || value === null || value === "") {
      return true;
    }

    if (typeof value !== "string") {
      return false;
    }

    if (value.length > 2_000_000) {
      return false;
    }

    return isHttpUrl(value) || PRODUCT_IMAGE_DATA_URL_PATTERN.test(value);
  }

  defaultMessage() {
    return "imageUrl deve ser uma URL http/https valida ou uma imagem enviada do computador";
  }
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

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
  @Validate(ProductImageReferenceConstraint)
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  available?: boolean;
}
