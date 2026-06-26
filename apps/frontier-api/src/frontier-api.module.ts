import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { FrontierApiController } from './frontier-api.controller.js';
import { FrontierApiService } from './frontier-api.service.js';
import { BaseTables1720373216667 } from "./database/migrations/1720373216667-base-tables.js";
import { FsarchModule } from "./fsarch/fsarch.module.js";
import { CachePolicy } from "./database/entities/cache-policy.entity.js";
import { DomainGroup } from "./database/entities/domain-group.entity.js";
import { DomainGroupDomain } from "./database/entities/domain-group-domain.entity.js";
import { PathRule } from "./database/entities/path-rule.entity.js";
import { Upstream } from "./database/entities/upstream.entity.js";
import { UpstreamGroup } from "./database/entities/upstream-group.entity.js";
import { ApiModule } from './api/api.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ApiModule,
  ],
  controllers: [FrontierApiController],
  providers: [FrontierApiService],
})
export class FrontierApiModule {}
