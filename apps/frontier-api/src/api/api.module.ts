import { Module } from '@nestjs/common';
import { DomainGroupModule } from './domain-group/domain-group.module';
import { WorkersModule } from './workers/workers.module';

@Module({
  imports: [DomainGroupModule, WorkersModule]
})
export class ApiModule {}
