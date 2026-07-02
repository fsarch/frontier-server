import { Module } from '@nestjs/common';
import { DomainGroupModule } from './domain-group/domain-group.module.js';
import { WorkersModule } from './workers/workers.module.js';
import { HookModule } from './hooks/hook.module.js';

@Module({
  imports: [DomainGroupModule, WorkersModule, HookModule]
})
export class ApiModule {}
