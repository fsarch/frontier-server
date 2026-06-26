import { Module } from '@nestjs/common';
import { CachePolicyService } from './cache-policy.service.js';
import { CachePolicyController } from './cache-policy.controller.js';
import { TypeOrmModule } from "@nestjs/typeorm";
import { CachePolicy } from "../../../database/entities/cache-policy.entity.js";

@Module({
  providers: [CachePolicyService],
  exports: [CachePolicyService],
  controllers: [CachePolicyController],
  imports: [TypeOrmModule.forFeature([CachePolicy])],
})
export class CachePolicyModule {}
