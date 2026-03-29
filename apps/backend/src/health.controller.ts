import { Controller, Get } from "@nestjs/common";
import type { HealthStatus } from "@deliveries/shared-types";

@Controller("health")
export class HealthController {
  @Get()
  getStatus(): HealthStatus {
    return {
      service: "backend",
      status: "ok",
      timestamp: new Date().toISOString()
    };
  }
}
