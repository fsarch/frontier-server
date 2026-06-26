import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../../../fsarch/auth/guards/auth.guard.js";
import { Roles } from "../../../fsarch/uac/decorators/roles.decorator.js";
import { Role } from "../../../fsarch/auth/role.enum.js";
import { CachePolicyService } from "./cache-policy.service.js";
import { CachePolicyCreateDto, CachePolicyDto, CachePolicyUpdateDto } from "../../../models/cache-policy.model.js";

@ApiTags('cache-policies')
@Controller({
  path: 'domain-groups/:domainGroupId/cache-policies',
  version: '1',
})
@ApiBearerAuth()
export class CachePolicyController {
  constructor(
    private readonly cachePolicyService: CachePolicyService,
  ) {
  }

  @Post()
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async Create(
    @Body() cachePolicyCreateDto: CachePolicyCreateDto,
    @Param('domainGroupId') domainGroupId: string,
  ) {
    return await this.cachePolicyService.Create(
      domainGroupId,
      cachePolicyCreateDto,
    );
  }

  @Get()
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async List(
    @Param('domainGroupId') domainGroupId: string,
  ) {
    const cachePolicies = await this.cachePolicyService.ListByDomainGroupId(
      domainGroupId,
    );

    return cachePolicies.map(CachePolicyDto.FromDbo);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async Update(
    @Param('domainGroupId') domainGroupId: string,
    @Param('id') id: string,
    @Body() cachePolicyUpdateDto: CachePolicyUpdateDto,
  ) {
    await this.cachePolicyService.Update(
      id,
      domainGroupId,
      cachePolicyUpdateDto,
    );
  }
}
