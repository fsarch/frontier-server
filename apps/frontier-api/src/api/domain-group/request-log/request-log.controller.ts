import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../../fsarch/auth/guards/auth.guard.js';
import { Roles } from '../../../fsarch/uac/decorators/roles.decorator.js';
import { Role } from '../../../fsarch/auth/role.enum.js';
import { RequestLogService } from './request-log.service.js';
import { RequestLogDto, RequestLogQueryDto } from '../../../models/request-log.model.js';

@ApiTags('request-logs')
@Controller({
  path: 'domain-groups/:domainGroupId/request-logs',
  version: '1',
})
@ApiBearerAuth()
export class RequestLogController {
  constructor(
    private readonly requestLogService: RequestLogService,
  ) {
  }

  @Get()
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async List(
    @Param('domainGroupId') domainGroupId: string,
    @Query() query: RequestLogQueryDto,
  ) {
    const logs = await this.requestLogService.ListByDomainGroupId(domainGroupId, query);

    return logs.map(RequestLogDto.FromDbo);
  }
}

