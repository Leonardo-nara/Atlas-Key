import { Transform } from "class-transformer";
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

import { trimString } from "../../common/validation/text";

export class CreateClientOrderItemDto {
  @Transform(trimString)
  @IsString()
  @MinLength(10)
  @MaxLength(40)
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}
