import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { DomainGroupCreateDto, DomainGroupDto } from "../../models/domain-group.model.js";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@fsarch/server/auth";
import { Roles } from "@fsarch/server/uac";
import { DomainGroupService } from "./domain-group.service.js";
import { Role } from "../../constants/role.enum.js";

@ApiTags('domain-groups')
@Controller({
  path: 'domain-groups',
  version: '1',
})
@ApiBearerAuth()
export class DomainGroupController {
  constructor(
    private readonly domainGroupService: DomainGroupService,
  ) {
  }

  @Post()
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async Create(@Body() domainGroupDto: DomainGroupCreateDto) {
    return await this.domainGroupService.Create(domainGroupDto);
  }

  @Get()
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async List() {
    const domainGroups = await this.domainGroupService.List();

    return domainGroups.map(DomainGroupDto.FromDbo);
  }
}
