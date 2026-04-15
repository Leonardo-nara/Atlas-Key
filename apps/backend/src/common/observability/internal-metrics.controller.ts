import {
  Controller,
  Get,
  Headers,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { securityMetrics } from "./security-metrics";

@Controller("internal")
export class InternalMetricsController {
  constructor(private readonly configService: ConfigService) {}

  @Get("metrics")
  metrics(
    @Headers("authorization") authorization?: string,
    @Headers("x-internal-metrics-token") internalToken?: string
  ) {
    const expectedToken = this.configService.get<string>("OPERATIONAL_METRICS_TOKEN");

    if (!expectedToken) {
      throw new NotFoundException("Recurso nao encontrado");
    }

    const bearerToken = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : undefined;

    if (internalToken !== expectedToken && bearerToken !== expectedToken) {
      throw new UnauthorizedException("Acesso nao autorizado");
    }

    return securityMetrics.snapshot();
  }
}
