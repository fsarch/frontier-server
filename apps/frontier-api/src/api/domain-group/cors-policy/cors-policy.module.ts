import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CorsPolicy } from '../../../database/entities/cors-policy.entity.js';
import { PathRule } from '../../../database/entities/path-rule.entity.js';
import { CorsPolicyController } from './cors-policy.controller.js';
import { CorsPolicyService } from './cors-policy.service.js';

@Module({
  providers: [CorsPolicyService],
  exports: [CorsPolicyService],
  controllers: [CorsPolicyController],
  imports: [TypeOrmModule.forFeature([CorsPolicy, PathRule])],
})
export class CorsPolicyModule {}
