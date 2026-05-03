import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";
import { Transform } from "class-transformer";
import { StorePixKeyType } from "@prisma/client";

import { trimString } from "../../common/validation/text";

export class UpdateStorePixSettingsDto {
  @IsOptional()
  @IsBoolean()
  pixEnabled?: boolean;

  @IsOptional()
  @IsEnum(StorePixKeyType)
  pixKeyType?: StorePixKeyType;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(160)
  pixKey?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(160)
  pixRecipientName?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  pixInstructions?: string;
}
