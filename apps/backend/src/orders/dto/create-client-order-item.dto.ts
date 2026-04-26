import { IsInt, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class CreateClientOrderItemDto {
  @IsString()
  @MinLength(10)
  @MaxLength(40)
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}
