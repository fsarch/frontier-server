import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../../../fsarch/auth/guards/auth.guard.js";
import { Roles } from "../../../fsarch/uac/decorators/roles.decorator.js";
import { Role } from "../../../fsarch/auth/role.enum.js";
import { UpstreamGroupService } from "./upstream-group.service.js";
import { UpstreamGroupCreateDto, UpstreamGroupDto } from "../../../models/upstream-group.model.js";

@ApiTags('upstream-groups')
@Controller({
  path: 'domain-groups/:domainGroupId/upstream-groups',
  version: '1',
})
@ApiBearerAuth()
export class UpstreamGroupController {
  constructor(
    private readonly upstreamGroupService: UpstreamGroupService,
  ) {
  }

  @Post()
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async Create(
    @Body() upstreamGroupCreateDto: UpstreamGroupCreateDto,
    @Param('domainGroupId') domainGroupId: string,
  ) {
    return await this.upstreamGroupService.Create(
      domainGroupId,
      upstreamGroupCreateDto,
    );
  }

  @Get()
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async List(
    @Param('domainGroupId') domainGroupId: string,
  ) {
    const pathRules = await this.upstreamGroupService.ListByDomainGroupId(
      domainGroupId,
    );

    return pathRules.map(UpstreamGroupDto.FromDbo);
  }
}
