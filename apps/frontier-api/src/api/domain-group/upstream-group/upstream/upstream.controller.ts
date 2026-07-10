import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from '@fsarch/server/auth';
import { Roles } from '@fsarch/server/uac';
import { UpstreamService } from "./upstream.service.js";
import { UpstreamCreateDto, UpstreamDto, UpstreamUpdateDto } from "../../../../models/upstream.model.js";
import { Role } from "../../../../constants/role.enum.js";

@ApiTags('upstream')
@Controller({
  path: 'domain-groups/:domainGroupId/upstream-groups/:upstreamGroupId/upstream',
  version: '1',
})
@ApiBearerAuth()
export class UpstreamController {
  constructor(
    private readonly upstreamService: UpstreamService,
  ) {
  }

  @Post()
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async Create(
    @Body() upstreamCreateDto: UpstreamCreateDto,
    @Param('upstreamGroupId') upstreamGroupId: string,
  ) {
    return await this.upstreamService.Create(
      upstreamGroupId,
      upstreamCreateDto,
    );
  }

  @Get()
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async List(
    @Param('upstreamGroupId') upstreamGroupId: string,
  ) {
    const pathRules = await this.upstreamService.ListByUpstreamGroupId(
      upstreamGroupId,
    );

    return pathRules.map(UpstreamDto.FromDbo);
  }

  @Get('/:id')
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async Get(
    @Param('id') id: string,
  ) {
    const upstream = await this.upstreamService.GetById(id);
    if (!upstream) {
      return null;
    }
    return UpstreamDto.FromDbo(upstream);
  }

  @Patch('/:id')
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async Patch(
    @Param('id') id: string,
    @Body() upstreamUpdateDto: UpstreamUpdateDto,
  ) {
    const upstream = await this.upstreamService.Update(id, upstreamUpdateDto);
    if (!upstream) {
      return null;
    }
    return UpstreamDto.FromDbo(upstream);
  }

  @Delete('/:id')
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async Delete(
    @Param('id') id: string,
  ) {
    const deleted = await this.upstreamService.Delete(id);
    return { success: deleted };
  }
}
