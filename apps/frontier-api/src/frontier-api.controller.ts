import { Controller, Get } from '@nestjs/common';
import { FrontierApiService } from './frontier-api.service.js';

@Controller()
export class FrontierApiController {
  constructor(private readonly frontierApiService: FrontierApiService) {}

  @Get()
  getHello(): string {
    return this.frontierApiService.getHello();
  }
}
