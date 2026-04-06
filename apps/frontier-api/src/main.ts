import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { VersioningType } from "@nestjs/common";
import { FrontierApiModule } from "./frontier-api.module";
import { WsAdapter } from '@nestjs/platform-ws';

async function bootstrap() {
  const app = await NestFactory.create(FrontierApiModule);

  app.enableCors();

  app.enableVersioning({
    type: VersioningType.URI,
  });

  const config = new DocumentBuilder()
    .setTitle('Frontier-API-Server')
    .setDescription('The Frontier API-Server is a utility service for configuring and managing the frontier-workers')
    .addBearerAuth()
    .setVersion('1.0')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, documentFactory);

  app.useWebSocketAdapter(new WsAdapter(app));

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
