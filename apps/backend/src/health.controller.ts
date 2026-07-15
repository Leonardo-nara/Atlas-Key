import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { HealthStatus } from "@deliveries/shared-types";

import { PrismaService } from "./prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  @Get()
  getStatus(): HealthStatus {
    return {
      service: "backend",
      status: "ok",
      timestamp: new Date().toISOString()
    };
  }

  @Get("readiness")
  async getReadiness() {
    const checks = {
      database: await this.checkDatabase(),
      storage: this.checkStorageConfiguration()
    };
    const ready = checks.database.status === "ok" && checks.storage.status === "ok";

    return {
      service: "backend",
      status: ready ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks
    };
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok" as const };
    } catch {
      return { status: "error" as const };
    }
  }

  private checkStorageConfiguration() {
    const paymentProofDriver = this.configService.get<string>("PAYMENT_PROOF_STORAGE_DRIVER") ?? "local";
    const imageDriver = this.configService.get<string>("IMAGE_STORAGE_DRIVER") ?? paymentProofDriver;
    const paymentProofConfigured = this.isStorageDriverConfigured("PAYMENT_PROOF", paymentProofDriver);
    const imageConfigured = this.isStorageDriverConfigured("IMAGE", imageDriver);

    return {
      status: paymentProofConfigured && imageConfigured ? "ok" as const : "degraded" as const,
      paymentProofDriver,
      imageDriver,
      paymentProofConfigured,
      imageConfigured
    };
  }

  private isStorageDriverConfigured(prefix: "PAYMENT_PROOF" | "IMAGE", driver: string) {
    if (driver !== "s3") {
      return true;
    }

    const fallbackPrefix = "PAYMENT_PROOF";
    const requiredKeys = ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"];

    return requiredKeys.every((key) =>
      Boolean(
        this.configService.get<string>(`${prefix}_${key}`) ??
          this.configService.get<string>(`${fallbackPrefix}_${key}`)
      )
    );
  }
}
