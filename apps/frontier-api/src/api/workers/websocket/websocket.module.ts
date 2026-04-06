import { Module } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { DomainModule } from "../../domain-group/domain/domain.module";
import { DomainGroupModule } from "../../domain-group/domain-group.module";
import { CachePolicyModule } from "../../domain-group/cache-policy/cache-policy.module";
import { UpstreamGroupModule } from "../../domain-group/upstream-group/upstream-group.module";
import { UpstreamModule } from "../../domain-group/upstream-group/upstream/upstream.module";
import { PathRuleModule } from "../../domain-group/path-rule/path-rule.module";

@Module({
  providers: [WebsocketGateway],
  imports: [DomainModule, DomainGroupModule, CachePolicyModule, UpstreamGroupModule, UpstreamModule, PathRuleModule],
})
export class WebsocketModule {}
