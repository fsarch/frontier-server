import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ApiModule } from './api/api.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ApiModule,
  ],
  controllers: [],
  providers: [],
})
export class FrontierApiModule {}
