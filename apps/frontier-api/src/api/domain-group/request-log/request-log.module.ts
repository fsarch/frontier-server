import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestLogController } from './request-log.controller.js';
import { RequestLogService } from './request-log.service.js';
import { RequestLog } from '../../../database/entities/request-log.entity.js';
import { LogPolicy } from '../../../database/entities/log-policy.entity.js';

@Module({
  providers: [RequestLogService],
  exports: [RequestLogService],
  controllers: [RequestLogController],
  imports: [TypeOrmModule.forFeature([RequestLog, LogPolicy])],
})
export class RequestLogModule {}

