import {
  BadRequestException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { User } from "@prisma/client";
import * as bcrypt from "bcryptjs";

import { UserRole } from "../common/enums/user-role.enum";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() }
    });

    if (existingUser) {
      throw new BadRequestException("Email ja cadastrado");
    }

    if (dto.role === UserRole.STORE_ADMIN && (!dto.storeName || !dto.storeAddress)) {
      throw new BadRequestException(
        "STORE_ADMIN precisa informar storeName e storeAddress"
      );
    }

    if (dto.role === UserRole.COURIER && (dto.storeName || dto.storeAddress)) {
      throw new BadRequestException("COURIER nao pode criar loja no registro");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email.toLowerCase(),
          passwordHash,
          phone: dto.phone,
          role: dto.role,
          active: true
        }
      });

      if (dto.role === UserRole.STORE_ADMIN) {
        await tx.store.create({
          data: {
            name: dto.storeName!,
            address: dto.storeAddress!,
            ownerUserId: createdUser.id,
            active: true
          }
        });
      }

      return createdUser;
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() }
    });

    if (!user || !user.active) {
      throw new UnauthorizedException("Credenciais invalidas");
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException("Credenciais invalidas");
    }

    return this.buildAuthResponse(user);
  }

  private async buildAuthResponse(user: User) {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role
    });

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        active: user.active,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    };
  }
}
