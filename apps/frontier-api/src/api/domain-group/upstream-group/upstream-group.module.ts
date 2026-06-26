import { Module } from '@nestjs/common';
import { UpstreamGroupService } from './upstream-group.service.js';
import { UpstreamGroupController } from './upstream-group.controller.js';
import { TypeOrmModule } from "@nestjs/typeorm";
import { UpstreamGroup } from "../../../database/entities/upstream-group.entity.js";
import { UpstreamModule } from './upstream/upstream.module.js';

@Module({
  providers: [UpstreamGroupService],
  exports: [UpstreamGroupService],
  controllers: [UpstreamGroupController],
  imports: [
    TypeOrmModule.forFeature([UpstreamGroup]),
    UpstreamModule,
  ],
})
export class UpstreamGroupModule {}
