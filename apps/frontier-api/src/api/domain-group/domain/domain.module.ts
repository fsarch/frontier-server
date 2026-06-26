import { Module } from '@nestjs/common';
import { DomainService } from './domain.service.js';
import { DomainController } from './domain.controller.js';
import { TypeOrmModule } from "@nestjs/typeorm";
import { DomainGroupDomain } from "../../../database/entities/domain-group-domain.entity.js";

@Module({
  providers: [DomainService],
  exports: [DomainService],
  controllers: [DomainController],
  imports: [
    TypeOrmModule.forFeature([DomainGroupDomain]),
  ],
})
export class DomainModule {}
