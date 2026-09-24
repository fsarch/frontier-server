import { AuthGuard } from '@fsarch/server/auth';
import { Roles } from '@fsarch/server/uac';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../constants/role.enum.js';
import {
  RequestLogDto,
  RequestLogQueryDto,
} from '../../../models/request-log.model.js';
import { RequestLogService } from './request-log.service.js';

@ApiTags('request-logs')
@Controller({
  path: 'domain-groups/:domainGroupId/request-logs',
  version: '1',
})
@ApiBearerAuth()
export class RequestLogController {
  constructor(private readonly requestLogService: RequestLogService) {}

  @Get()
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async List(
    @Param('domainGroupId') domainGroupId: string,
    @Query() query: RequestLogQueryDto,
  ) {
    const logs = await this.requestLogService.ListByDomainGroupId(
      domainGroupId,
      query,
    );

    return logs.map(RequestLogDto.FromDbo);
  }
}
