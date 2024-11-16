import { Module } from '@nestjs/common';
import { UpstreamGroupService } from './upstream-group.service';
import { UpstreamGroupController } from './upstream-group.controller';
import { TypeOrmModule } from "@nestjs/typeorm";
import { UpstreamGroup } from "../../../database/entities/upstream-group.entity";

@Module({
  providers: [UpstreamGroupService],
  controllers: [UpstreamGroupController],
  imports: [
    TypeOrmModule.forFeature([UpstreamGroup]),
  ],
})
export class UpstreamGroupModule {}