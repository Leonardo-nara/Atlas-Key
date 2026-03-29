import "dotenv/config";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "0.0.0.0";
  const apiPrefix = process.env.API_PREFIX ?? "api";
  const corsOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [
        process.env.CORS_ORIGIN_DESKTOP ?? "http://localhost:5173",
        process.env.CORS_ORIGIN_MOBILE ?? "exp://127.0.0.1:8081"
      ];

  app.setGlobalPrefix(apiPrefix);
  app.enableCors({
    origin: corsOrigins
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
}

bootstrap();
