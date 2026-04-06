import { Module } from '@nestjs/common';
import { DomainService } from './domain.service';
import { DomainController } from './domain.controller';
import { TypeOrmModule } from "@nestjs/typeorm";
import { DomainGroupDomain } from "../../../database/entities/domain-group-domain.entity";

@Module({
  providers: [DomainService],
  exports: [DomainService],
  controllers: [DomainController],
  imports: [
    TypeOrmModule.forFeature([DomainGroupDomain]),
  ],
})
export class DomainModule {}
