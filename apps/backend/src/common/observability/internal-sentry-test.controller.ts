import {
  Controller,
  Headers,
  InternalServerErrorException,
  NotFoundException,
  Post,
  PreconditionFailedException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Controller("internal")
export class InternalSentryTestController {
  constructor(private readonly configService: ConfigService) {}

  @Post("sentry-test")
  triggerSentryTest(
    @Headers("authorization") authorization?: string,
    @Headers("x-internal-metrics-token") internalToken?: string
  ) {
    const sentryTestEnabled =
      this.configService.get<string>("ENABLE_SENTRY_TEST_ENDPOINT") === "true";

    if (!sentryTestEnabled) {
      throw new NotFoundException("Recurso nao encontrado");
    }

    const expectedToken = this.configService.get<string>("OPERATIONAL_METRICS_TOKEN");

    if (!expectedToken) {
      throw new PreconditionFailedException(
        "OPERATIONAL_METRICS_TOKEN nao configurado"
      );
    }

    const bearerToken = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : undefined;

    if (internalToken !== expectedToken && bearerToken !== expectedToken) {
      throw new UnauthorizedException("Acesso nao autorizado");
    }

    throw new InternalServerErrorException(
      "Teste operacional controlado do Sentry"
    );
  }
}
