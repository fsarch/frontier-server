import { Module } from '@nestjs/common';
import { CachePolicyService } from './cache-policy.service';
import { CachePolicyController } from './cache-policy.controller';
import { TypeOrmModule } from "@nestjs/typeorm";
import { CachePolicy } from "../../../database/entities/cache-policy.entity";

@Module({
  providers: [CachePolicyService],
  exports: [CachePolicyService],
  controllers: [CachePolicyController],
  imports: [TypeOrmModule.forFeature([CachePolicy])],
})
export class CachePolicyModule {}
