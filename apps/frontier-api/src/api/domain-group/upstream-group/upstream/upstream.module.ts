import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Upstream } from '../../../../database/entities/upstream.entity.js';
import { UpstreamSslOptions } from '../../../../database/entities/upstream-ssl-options.entity.js';
import { UpstreamController } from './upstream.controller.js';
import { UpstreamService } from './upstream.service.js';

@Module({
  providers: [UpstreamService],
  exports: [UpstreamService],
  controllers: [UpstreamController],
  imports: [TypeOrmModule.forFeature([Upstream, UpstreamSslOptions])],
})
export class UpstreamModule {}
