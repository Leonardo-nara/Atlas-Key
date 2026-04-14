import "dotenv/config";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";

import { AppModule } from "./app.module";
import { getAllowedCorsOrigins, isCorsOriginAllowed } from "./common/security/cors";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "0.0.0.0";
  const apiPrefix = process.env.API_PREFIX ?? "api";
  const corsOrigins = getAllowedCorsOrigins();
  const httpServer = app.getHttpAdapter().getInstance() as {
    disable: (setting: string) => void;
    set: (setting: string, value: unknown) => void;
  };

  httpServer.set("trust proxy", 1);
  app.setGlobalPrefix(apiPrefix);
  httpServer.disable("x-powered-by");
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false
    })
  );
  app.enableCors({
    origin(
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void
    ) {
      if (isCorsOriginAllowed(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origem CORS nao permitida"), false);
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: false,
    maxAge: 86400
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );

  await app.listen(port, host);

  Logger.log(
    `Backend disponivel em http://${host}:${port}/${apiPrefix}`,
    "Bootstrap"
  );
  Logger.log(
    `CORS permitido para: ${corsOrigins.length ? corsOrigins.join(", ") : "nenhuma origem de browser configurada"}`,
    "Bootstrap"
  );
}

bootstrap();
