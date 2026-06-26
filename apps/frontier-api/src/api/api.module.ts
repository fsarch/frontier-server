import { Module } from '@nestjs/common';
import { DomainGroupModule } from './domain-group/domain-group.module.js';
import { WorkersModule } from './workers/workers.module.js';

@Module({
  imports: [DomainGroupModule, WorkersModule]
})
export class ApiModule {}
