import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@fsarch/server/auth";
import { Roles } from "@fsarch/server/uac";
import { DomainGroupDomainCreateDto, DomainGroupDomainDto } from "../../../models/domain-group-domain.model.js";
import { DomainService } from "./domain.service.js";
import { Role } from "../../../constants/role.enum";

@ApiTags('domain')
@Controller({
  path: 'domain-groups/:domainGroupId/domain',
  version: '1',
})
@ApiBearerAuth()
export class DomainController {
  constructor(
    private readonly domainGroupDomainService: DomainService
  ) {}

  @Post()
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async Create(
    @Body() domainGroupDomainDto: DomainGroupDomainCreateDto,
    @Param('domainGroupId') domainGroupId: string,
  ) {
    return await this.domainGroupDomainService.Create(
      domainGroupId,
      domainGroupDomainDto,
    );
  }

  @Get()
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async List(
    @Param('domainGroupId') domainGroupId: string,
  ) {
    const domains = await this.domainGroupDomainService.ListByDomainGroupId(
      domainGroupId,
    );

    return domains.map(DomainGroupDomainDto.FromDbo);
  }
}
