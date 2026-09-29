import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { setupApp } from './setup-app.js';
import { setupSwagger } from './swagger.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.enableShutdownHooks();
  setupApp(app);
  setupSwagger(app);
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
