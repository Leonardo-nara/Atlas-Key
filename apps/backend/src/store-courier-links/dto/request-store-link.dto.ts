import { IsString, MinLength } from "class-validator";

export class RequestStoreLinkDto {
  @IsString()
  @MinLength(1)
  storeId!: string;
}
