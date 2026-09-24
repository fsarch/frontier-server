import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UpstreamGroup } from '../../../database/entities/upstream-group.entity.js';
import { UpstreamModule } from './upstream/upstream.module.js';
import { UpstreamGroupController } from './upstream-group.controller.js';
import { UpstreamGroupService } from './upstream-group.service.js';

@Module({
  providers: [UpstreamGroupService],
  exports: [UpstreamGroupService],
  controllers: [UpstreamGroupController],
  imports: [TypeOrmModule.forFeature([UpstreamGroup]), UpstreamModule],
})
export class UpstreamGroupModule {}
