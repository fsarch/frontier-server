import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogPolicyController } from './log-policy.controller';
import { LogPolicyService } from './log-policy.service';
import { LogPolicy } from '../../../database/entities/log-policy.entity';
import { PathRule } from '../../../database/entities/path-rule.entity';

@Module({
  providers: [LogPolicyService],
  exports: [LogPolicyService],
  controllers: [LogPolicyController],
  imports: [TypeOrmModule.forFeature([LogPolicy, PathRule])],
})
export class LogPolicyModule {}

