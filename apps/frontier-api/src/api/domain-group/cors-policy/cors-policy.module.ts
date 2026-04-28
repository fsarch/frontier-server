import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CorsPolicyService } from './cors-policy.service';
import { CorsPolicyController } from './cors-policy.controller';
import { CorsPolicy } from '../../../database/entities/cors-policy.entity';
import { PathRule } from '../../../database/entities/path-rule.entity';

@Module({
  providers: [CorsPolicyService],
  exports: [CorsPolicyService],
  controllers: [CorsPolicyController],
  imports: [TypeOrmModule.forFeature([CorsPolicy, PathRule])],
})
export class CorsPolicyModule {}

