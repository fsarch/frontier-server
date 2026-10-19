import { FsArchAppBuilder } from '@fsarch/server';
import { WsAdapter } from '@nestjs/platform-ws';
import { descriptor } from './lib/index.js';

async function bootstrap() {
  const app = await new FsArchAppBuilder(descriptor.module.register(), {
    name: 'Frontier-API-Server',
    version: '1.0.0',
  })
    .addSwagger(descriptor.swagger)
    .enableAuth()
    .setDatabase({ entities: descriptor.entities, migrations: descriptor.migrations })
    .build();

  app.useWebSocketAdapter(new WsAdapter(app));

  await app.listen(process.env.PORT ?? 8080);
}

bootstrap();
