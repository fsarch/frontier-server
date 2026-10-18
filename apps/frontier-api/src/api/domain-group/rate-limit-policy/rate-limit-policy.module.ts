import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PathRule } from '../../../database/entities/path-rule.entity.js';
import { RateLimitPolicy } from '../../../database/entities/rate-limit-policy.entity.js';
import { RateLimitPolicyController } from './rate-limit-policy.controller.js';
import { RateLimitPolicyService } from './rate-limit-policy.service.js';

@Module({
  providers: [RateLimitPolicyService],
  exports: [RateLimitPolicyService],
  controllers: [RateLimitPolicyController],
  imports: [TypeOrmModule.forFeature([RateLimitPolicy, PathRule])],
})
export class RateLimitPolicyModule {}
