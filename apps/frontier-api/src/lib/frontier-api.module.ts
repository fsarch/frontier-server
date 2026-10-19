import { createServiceModule } from '@fsarch/server';
import { ModuleConfiguration } from '@fsarch/server/configuration';
import { CachePolicy } from '../database/entities/cache-policy.entity.js';
import { CorsPolicy } from '../database/entities/cors-policy.entity.js';
import { DomainGroup } from '../database/entities/domain-group.entity.js';
import { DomainGroupDomain } from '../database/entities/domain-group-domain.entity.js';
import { Hook } from '../database/entities/hook.entity.js';
import { LogPolicy } from '../database/entities/log-policy.entity.js';
import { PathRule } from '../database/entities/path-rule.entity.js';
import { RateLimitPolicy } from '../database/entities/rate-limit-policy.entity.js';
import { RequestLog } from '../database/entities/request-log.entity.js';
import { Upstream } from '../database/entities/upstream.entity.js';
import { UpstreamGroup } from '../database/entities/upstream-group.entity.js';
import { UpstreamSslOptions } from '../database/entities/upstream-ssl-options.entity.js';
import { DomainController } from '../api/domain-group/domain/domain.controller.js';
import { DomainService } from '../api/domain-group/domain/domain.service.js';
import { DomainGroupController } from '../api/domain-group/domain-group.controller.js';
import { DomainGroupService } from '../api/domain-group/domain-group.service.js';
import { CachePolicyController } from '../api/domain-group/cache-policy/cache-policy.controller.js';
import { CachePolicyService } from '../api/domain-group/cache-policy/cache-policy.service.js';
import { CorsPolicyController } from '../api/domain-group/cors-policy/cors-policy.controller.js';
import { CorsPolicyService } from '../api/domain-group/cors-policy/cors-policy.service.js';
import { LogPolicyController } from '../api/domain-group/log-policy/log-policy.controller.js';
import { LogPolicyService } from '../api/domain-group/log-policy/log-policy.service.js';
import { PathRuleController } from '../api/domain-group/path-rule/path-rule.controller.js';
import { PathRuleService } from '../api/domain-group/path-rule/path-rule.service.js';
import { RateLimitPolicyController } from '../api/domain-group/rate-limit-policy/rate-limit-policy.controller.js';
import { RateLimitPolicyService } from '../api/domain-group/rate-limit-policy/rate-limit-policy.service.js';
import { RequestLogController } from '../api/domain-group/request-log/request-log.controller.js';
import { RequestLogService } from '../api/domain-group/request-log/request-log.service.js';
import { UpstreamGroupController } from '../api/domain-group/upstream-group/upstream-group.controller.js';
import { UpstreamGroupService } from '../api/domain-group/upstream-group/upstream-group.service.js';
import { UpstreamController } from '../api/domain-group/upstream-group/upstream/upstream.controller.js';
import { UpstreamService } from '../api/domain-group/upstream-group/upstream/upstream.service.js';
import { HookController } from '../api/hooks/hook.controller.js';
import { HookService } from '../api/hooks/hook.service.js';
import { WorkerBootstrapController } from '../api/workers/worker-bootstrap.controller.js';
import { WorkerBootstrapService } from '../api/workers/worker-bootstrap.service.js';
import { WorkerLogController } from '../api/workers/websocket/worker-log.controller.js';
import { WebsocketGateway } from '../api/workers/websocket/websocket.gateway.js';
import { WORKERS_CONFIG_VALIDATOR } from '../api/workers/websocket/workers-config.validator.js';

/**
 * The service's feature module, generated via `@fsarch/server`'s
 * `createServiceModule()` instead of hand-written as the previous
 * `FrontierApiModule -> ApiModule -> DomainGroupModule/WorkersModule -> ...`
 * tree of 15 per-resource wrapper modules, each doing its own unscoped
 * `TypeOrmModule.forFeature(...)`. Flattened for the same reason as
 * `image-editor-server`/`image-server`: `createServiceModule()`'s single
 * `TypeOrmModule.forFeature(entities, connectionName)` call only covers
 * providers/controllers declared *directly* in the module it generates — a
 * nested module doing its own separate `forFeature()` would still bind to
 * the *default* connection, which doesn't exist in a mono-service mount.
 *
 * The old root `FrontierApiModule`'s own `ScheduleModule.forRoot()` (for
 * `RequestLogService`'s `@Cron()` cleanup job) is dropped (not carried
 * forward here) - `@nestjs/schedule`'s cron scanning is process-wide via
 * `DiscoveryModule` regardless of which module imported `ScheduleModule`,
 * and `@fsarch/server`'s `FsarchModule` already registers
 * `ScheduleModule.forRoot()` globally once per process, so `@Cron()` is
 * picked up without a second registration here. A second registration is
 * redundant at best - and, mounted alongside other services via
 * `FsArchAppBuilder.addService()`, a second `global: true` dynamic-module
 * registration of the same shared `ScheduleModule` class is exactly the
 * pattern that was found (for `@nestjs/config`'s `ConfigModule`, in
 * `image-server`) to corrupt Nest's module-token bookkeeping for every
 * other concurrently mounted service's own `AuthModule.register(id)` - see
 * `@fsarch/server`'s mono-service harness notes.
 *
 * `ModuleConfiguration.register('WORKERS_CONFIG', ...)` keeps its existing
 * `name: 'workers'` config-section lookup, now threaded through the
 * generated module's `connectionName` as `serviceId` so a mono-service
 * mount reads its own `services[].config.workers` entry instead of the flat
 * root `workers:` section.
 */
export const FrontierApiModule = createServiceModule({
  entities: [
    CachePolicy,
    CorsPolicy,
    DomainGroup,
    DomainGroupDomain,
    Hook,
    LogPolicy,
    PathRule,
    RateLimitPolicy,
    RequestLog,
    Upstream,
    UpstreamSslOptions,
    UpstreamGroup,
  ],
  controllers: [
    DomainGroupController,
    CachePolicyController,
    CorsPolicyController,
    LogPolicyController,
    PathRuleController,
    RateLimitPolicyController,
    RequestLogController,
    UpstreamGroupController,
    UpstreamController,
    DomainController,
    HookController,
    WorkerLogController,
    WorkerBootstrapController,
  ],
  providers: [
    DomainGroupService,
    CachePolicyService,
    CorsPolicyService,
    LogPolicyService,
    PathRuleService,
    RateLimitPolicyService,
    RequestLogService,
    UpstreamGroupService,
    UpstreamService,
    DomainService,
    HookService,
    WebsocketGateway,
    WorkerBootstrapService,
  ],
  imports: (serviceId) => [
    ModuleConfiguration.register('WORKERS_CONFIG', {
      name: 'workers',
      validationSchema: WORKERS_CONFIG_VALIDATOR,
      serviceId,
    }),
  ],
});
