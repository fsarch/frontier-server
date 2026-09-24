import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CorsPolicy } from '../../../database/entities/cors-policy.entity.js';
import { LogPolicy } from '../../../database/entities/log-policy.entity.js';
import { PathRule } from '../../../database/entities/path-rule.entity.js';
import { PathRuleController } from './path-rule.controller.js';
import { PathRuleService } from './path-rule.service.js';

@Module({
  providers: [PathRuleService],
  exports: [PathRuleService],
  controllers: [PathRuleController],
  imports: [TypeOrmModule.forFeature([PathRule, CorsPolicy, LogPolicy])],
})
export class PathRuleModule {}
