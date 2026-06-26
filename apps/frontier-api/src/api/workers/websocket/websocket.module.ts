import { Module } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway.js';
import { DomainModule } from "../../domain-group/domain/domain.module.js";
import { DomainGroupModule } from "../../domain-group/domain-group.module.js";
import { CachePolicyModule } from "../../domain-group/cache-policy/cache-policy.module.js";
import { CorsPolicyModule } from "../../domain-group/cors-policy/cors-policy.module.js";
import { LogPolicyModule } from "../../domain-group/log-policy/log-policy.module.js";
import { RequestLogModule } from '../../domain-group/request-log/request-log.module.js';
import { UpstreamGroupModule } from "../../domain-group/upstream-group/upstream-group.module.js";
import { UpstreamModule } from "../../domain-group/upstream-group/upstream/upstream.module.js";
import { PathRuleModule } from "../../domain-group/path-rule/path-rule.module.js";
import { ModuleConfiguration } from "@fsarch/server/configuration";
import { WORKERS_CONFIG_VALIDATOR } from './workers-config.validator.js';
import { WorkerLogController } from './worker-log.controller.js';

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
