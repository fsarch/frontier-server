import { Module } from '@nestjs/common';
import { UpstreamService } from './upstream.service.js';
import { UpstreamController } from './upstream.controller.js';
import { TypeOrmModule } from "@nestjs/typeorm";
import { Upstream } from "../../../../database/entities/upstream.entity.js";

@Module({
  providers: [UpstreamService],
  exports: [UpstreamService],
  controllers: [UpstreamController],
  imports: [
    TypeOrmModule.forFeature([Upstream]),
  ],
})
export class UpstreamModule {}
