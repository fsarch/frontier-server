import { Module } from '@nestjs/common';
import { DomainGroupService } from './domain-group.service';
import { DomainGroupController } from './domain-group.controller';
import { DomainModule } from './domain/domain.module';
import { DomainGroup } from "../../database/entities/domain-group.entity";
import { TypeOrmModule } from "@nestjs/typeorm";

@Module({
  providers: [DomainGroupService],
  controllers: [DomainGroupController],
  imports: [
    DomainModule,
    TypeOrmModule.forFeature([DomainGroup]),
  ]
})
export class DomainGroupModule {}