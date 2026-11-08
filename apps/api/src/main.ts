import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import type { ApiEnvironment } from "./config/environment";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const config = app.get(ConfigService<ApiEnvironment, true>);
  await app.listen(
    config.get("API_PORT", { infer: true }),
    config.get("API_HOST", { infer: true }),
  );
}

void bootstrap();
