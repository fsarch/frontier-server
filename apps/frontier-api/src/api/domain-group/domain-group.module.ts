import { Module } from '@nestjs/common';
import { DomainGroupService } from './domain-group.service.js';
import { DomainGroupController } from './domain-group.controller.js';
import { DomainModule } from './domain/domain.module.js';
import { DomainGroup } from "../../database/entities/domain-group.entity.js";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CachePolicyModule } from './cache-policy/cache-policy.module.js';
import { CorsPolicyModule } from './cors-policy/cors-policy.module.js';
import { LogPolicyModule } from './log-policy/log-policy.module.js';
import { PathRuleModule } from './path-rule/path-rule.module.js';
import { RequestLogModule } from './request-log/request-log.module.js';
import { UpstreamGroupModule } from './upstream-group/upstream-group.module.js';

@Module({
  providers: [DomainGroupService],
  exports: [DomainGroupService],
  controllers: [DomainGroupController],
  imports: [
    DomainModule,
    TypeOrmModule.forFeature([DomainGroup]),
    CachePolicyModule,
    CorsPolicyModule,
    LogPolicyModule,
    PathRuleModule,
    RequestLogModule,
    UpstreamGroupModule,
  ]
})
export class DomainGroupModule {}
