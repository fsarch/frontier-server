import { Module } from '@nestjs/common';
import { UpstreamService } from './upstream.service';
import { UpstreamController } from './upstream.controller';
import { TypeOrmModule } from "@nestjs/typeorm";
import { Upstream } from "../../../../database/entities/upstream.entity";

@Module({
  providers: [UpstreamService],
  exports: [UpstreamService],
  controllers: [UpstreamController],
  imports: [
    TypeOrmModule.forFeature([Upstream]),
  ],
})
export class UpstreamModule {}
