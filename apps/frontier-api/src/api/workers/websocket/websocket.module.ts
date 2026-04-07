import { Module } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { DomainModule } from "../../domain-group/domain/domain.module";
import { DomainGroupModule } from "../../domain-group/domain-group.module";
import { CachePolicyModule } from "../../domain-group/cache-policy/cache-policy.module";
import { UpstreamGroupModule } from "../../domain-group/upstream-group/upstream-group.module";
import { UpstreamModule } from "../../domain-group/upstream-group/upstream/upstream.module";
import { PathRuleModule } from "../../domain-group/path-rule/path-rule.module";
import { ModuleConfiguration } from "../../../fsarch/configuration/module/module-configuration.module";
import { WORKERS_CONFIG_VALIDATOR } from './workers-config.validator';

@Module({
  providers: [WebsocketGateway],
  imports: [
    DomainModule,
    DomainGroupModule,
    CachePolicyModule,
    UpstreamGroupModule,
    UpstreamModule,
    PathRuleModule,
    ModuleConfiguration.register('WORKERS_CONFIG', {
      name: 'workers',
      validationSchema: WORKERS_CONFIG_VALIDATOR,
    }),
  ],
})
export class WebsocketModule {}
