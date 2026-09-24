import { ModuleConfiguration } from '@fsarch/server/configuration';
import { Module } from '@nestjs/common';
import { CachePolicyModule } from '../../domain-group/cache-policy/cache-policy.module.js';
import { CorsPolicyModule } from '../../domain-group/cors-policy/cors-policy.module.js';
import { DomainModule } from '../../domain-group/domain/domain.module.js';
import { DomainGroupModule } from '../../domain-group/domain-group.module.js';
import { LogPolicyModule } from '../../domain-group/log-policy/log-policy.module.js';
import { PathRuleModule } from '../../domain-group/path-rule/path-rule.module.js';
import { RequestLogModule } from '../../domain-group/request-log/request-log.module.js';
import { UpstreamModule } from '../../domain-group/upstream-group/upstream/upstream.module.js';
import { UpstreamGroupModule } from '../../domain-group/upstream-group/upstream-group.module.js';
import { HookModule } from '../../hooks/hook.module.js';
import { WorkerBootstrapController } from '../worker-bootstrap.controller.js';
import { WorkerBootstrapService } from '../worker-bootstrap.service.js';
import { WebsocketGateway } from './websocket.gateway.js';
import { WorkerLogController } from './worker-log.controller.js';
import { WORKERS_CONFIG_VALIDATOR } from './workers-config.validator.js';

@Module({
  providers: [WebsocketGateway, WorkerBootstrapService],
  controllers: [WorkerLogController, WorkerBootstrapController],
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
    HookModule,
    ModuleConfiguration.register('WORKERS_CONFIG', {
      name: 'workers',
      validationSchema: WORKERS_CONFIG_VALIDATOR,
    }),
  ],
  exports: [WorkerBootstrapService],
})
export class WebsocketModule {}
