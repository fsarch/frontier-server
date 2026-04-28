import { Module } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { DomainModule } from "../../domain-group/domain/domain.module";
import { DomainGroupModule } from "../../domain-group/domain-group.module";
import { CachePolicyModule } from "../../domain-group/cache-policy/cache-policy.module";
import { CorsPolicyModule } from "../../domain-group/cors-policy/cors-policy.module";
import { LogPolicyModule } from "../../domain-group/log-policy/log-policy.module";
import { RequestLogModule } from '../../domain-group/request-log/request-log.module';
import { UpstreamGroupModule } from "../../domain-group/upstream-group/upstream-group.module";
import { UpstreamModule } from "../../domain-group/upstream-group/upstream/upstream.module";
import { PathRuleModule } from "../../domain-group/path-rule/path-rule.module";
import { ModuleConfiguration } from "../../../fsarch/configuration/module/module-configuration.module";
import { WORKERS_CONFIG_VALIDATOR } from './workers-config.validator';
import { WorkerLogController } from './worker-log.controller';

@Module({
  providers: [WebsocketGateway],
  controllers: [WorkerLogController],
  imports: [
    DomainModule,
    DomainGroupModule,
    CachePolicyModule,
    CorsPolicyModule,
    LogPolicyModule,
    RequestLogModule,
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
