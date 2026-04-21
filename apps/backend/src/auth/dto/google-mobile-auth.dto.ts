import { Transform } from "class-transformer";
import { IsJWT, IsString, MaxLength } from "class-validator";

function normalizeToken({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim() : value;
}

export class GoogleMobileAuthDto {
  @Transform(normalizeToken)
  @IsString()
  @IsJWT()
  @MaxLength(4096)
  idToken!: string;
}
