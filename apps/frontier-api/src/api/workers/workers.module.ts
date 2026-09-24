import { Module } from '@nestjs/common';
import { WebsocketModule } from './websocket/websocket.module.js';

@Module({
  imports: [WebsocketModule],
  providers: [],
})
export class WorkersModule {}
