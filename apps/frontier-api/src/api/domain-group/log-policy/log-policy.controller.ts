import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@fsarch/server/auth';
import { Roles } from '@fsarch/server/uac';
import { LogPolicyService } from './log-policy.service.js';
import { LogPolicyCreateDto, LogPolicyDto, LogPolicyUpdateDto } from '../../../models/log-policy.model.js';
import { Role } from "../../../constants/role.enum.js";

@ApiTags('log-policies')
@Controller({
  path: 'domain-groups/:domainGroupId/log-policies',
  version: '1',
})
@ApiBearerAuth()
export class LogPolicyController {
  constructor(
    private readonly logPolicyService: LogPolicyService,
  ) {
  }

  @Post()
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async Create(
    @Body() logPolicyCreateDto: LogPolicyCreateDto,
    @Param('domainGroupId') domainGroupId: string,
  ) {
    return this.logPolicyService.Create(domainGroupId, logPolicyCreateDto);
  }

  @Get()
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async List(
    @Param('domainGroupId') domainGroupId: string,
  ) {
    const policies = await this.logPolicyService.ListByDomainGroupId(domainGroupId);

    return policies.map(LogPolicyDto.FromDbo);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async GetById(
    @Param('domainGroupId') domainGroupId: string,
    @Param('id') id: string,
  ) {
    const policy = await this.logPolicyService.GetById(id, domainGroupId);

    return LogPolicyDto.FromDbo(policy);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async Update(
    @Param('domainGroupId') domainGroupId: string,
    @Param('id') id: string,
    @Body() logPolicyUpdateDto: LogPolicyUpdateDto,
  ) {
    const updated = await this.logPolicyService.Update(id, domainGroupId, logPolicyUpdateDto);

    return LogPolicyDto.FromDbo(updated);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async Delete(
    @Param('domainGroupId') domainGroupId: string,
    @Param('id') id: string,
  ) {
    await this.logPolicyService.Delete(id, domainGroupId);
  }
}

