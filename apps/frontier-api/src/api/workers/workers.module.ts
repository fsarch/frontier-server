import { Module } from '@nestjs/common';
import { WebsocketModule } from './websocket/websocket.module';
import { DomainModule } from "../domain-group/domain/domain.module";
import { DomainGroupModule } from "../domain-group/domain-group.module";

@Module({
  imports: [WebsocketModule],
  providers: [],
})
export class WorkersModule {}
