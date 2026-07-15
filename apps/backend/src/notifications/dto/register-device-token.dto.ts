import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

const PUSH_PLATFORMS = ["android", "ios", "web"] as const;

export class RegisterDeviceTokenDto {
  @IsString()
  @MinLength(20)
  @MaxLength(255)
  token!: string;

  @IsIn(PUSH_PLATFORMS)
  platform!: (typeof PUSH_PLATFORMS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  appProfile?: string;
}
