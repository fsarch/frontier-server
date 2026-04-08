import { FrontierApiModule } from "./frontier-api.module";
import { WsAdapter } from '@nestjs/platform-ws';
import { FsArchAppBuilder } from "./fsarch/FsArchApp";
import { DATABASE_OPTIONS } from "./database";

async function bootstrap() {
  const app = await new FsArchAppBuilder(FrontierApiModule, {
    name: 'Frontier-API-Server',
    version: '1.0.0',
  })
    .addSwagger({
      title: 'Frontier-API-Server',
      description: 'The Frontier API-Server is a utility service for configuring and managing the frontier-workers',
      version: '1.0',
    })
    .enableAuth()
    .setDatabase(DATABASE_OPTIONS)
    .build();

  app.useWebSocketAdapter(new WsAdapter(app));

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
