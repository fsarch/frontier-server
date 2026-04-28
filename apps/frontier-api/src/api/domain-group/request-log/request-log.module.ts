import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestLogController } from './request-log.controller';
import { RequestLogService } from './request-log.service';
import { RequestLog } from '../../../database/entities/request-log.entity';
import { LogPolicy } from '../../../database/entities/log-policy.entity';

@Module({
  providers: [RequestLogService],
  exports: [RequestLogService],
  controllers: [RequestLogController],
  imports: [TypeOrmModule.forFeature([RequestLog, LogPolicy])],
})
export class RequestLogModule {}

