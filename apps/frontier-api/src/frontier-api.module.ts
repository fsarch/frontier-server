import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { FrontierApiController } from './frontier-api.controller.js';
import { FrontierApiService } from './frontier-api.service.js';
import { ApiModule } from './api/api.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ApiModule,
  ],
  controllers: [FrontierApiController],
  providers: [FrontierApiService],
})
export class FrontierApiModule {}
