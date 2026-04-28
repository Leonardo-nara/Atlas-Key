import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";
import { StorePixKeyType } from "@prisma/client";

export class UpdateStorePixSettingsDto {
  @IsOptional()
  @IsBoolean()
  pixEnabled?: boolean;

  @IsOptional()
  @IsEnum(StorePixKeyType)
  pixKeyType?: StorePixKeyType;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  pixKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  pixRecipientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  pixInstructions?: string;
}
