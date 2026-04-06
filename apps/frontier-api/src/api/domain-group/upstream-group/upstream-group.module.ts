import { Module } from '@nestjs/common';
import { UpstreamGroupService } from './upstream-group.service';
import { UpstreamGroupController } from './upstream-group.controller';
import { TypeOrmModule } from "@nestjs/typeorm";
import { UpstreamGroup } from "../../../database/entities/upstream-group.entity";
import { UpstreamModule } from './upstream/upstream.module';

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
