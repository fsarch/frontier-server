import { Module } from '@nestjs/common';
import { WebsocketModule } from './websocket/websocket.module.js';
import { DomainModule } from "../domain-group/domain/domain.module.js";
import { DomainGroupModule } from "../domain-group/domain-group.module.js";

@Module({
  imports: [WebsocketModule],
  providers: [],
})
export class WorkersModule {}
