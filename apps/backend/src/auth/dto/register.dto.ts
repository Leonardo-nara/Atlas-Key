import {
  IsEmail,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf
} from "class-validator";

import { UserRole } from "../../common/enums/user-role.enum";

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(64)
  password!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(20)
  phone!: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @ValidateIf((dto: RegisterDto) => dto.role === UserRole.STORE_ADMIN)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  storeName?: string;

  @ValidateIf((dto: RegisterDto) => dto.role === UserRole.STORE_ADMIN)
  @IsString()
  @MinLength(5)
  @MaxLength(240)
  storeAddress?: string;
}
