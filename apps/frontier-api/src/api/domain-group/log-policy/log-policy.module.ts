import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogPolicyController } from './log-policy.controller.js';
import { LogPolicyService } from './log-policy.service.js';
import { LogPolicy } from '../../../database/entities/log-policy.entity.js';
import { PathRule } from '../../../database/entities/path-rule.entity.js';

@Module({
  providers: [LogPolicyService],
  exports: [LogPolicyService],
  controllers: [LogPolicyController],
  imports: [TypeOrmModule.forFeature([LogPolicy, PathRule])],
})
export class LogPolicyModule {}

