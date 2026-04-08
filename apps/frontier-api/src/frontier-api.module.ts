import { Module } from '@nestjs/common';
import { FrontierApiController } from './frontier-api.controller';
import { FrontierApiService } from './frontier-api.service';
import { BaseTables1720373216667 } from "./database/migrations/1720373216667-base-tables";
import { FsarchModule } from "./fsarch/fsarch.module";
import { CachePolicy } from "./database/entities/cache-policy.entity";
import { DomainGroup } from "./database/entities/domain-group.entity";
import { DomainGroupDomain } from "./database/entities/domain-group-domain.entity";
import { PathRule } from "./database/entities/path-rule.entity";
import { Upstream } from "./database/entities/upstream.entity";
import { UpstreamGroup } from "./database/entities/upstream-group.entity";
import { ApiModule } from './api/api.module';

@Module({
  imports: [
    ApiModule,
  ],
  controllers: [FrontierApiController],
  providers: [FrontierApiService],
})
export class FrontierApiModule {}
