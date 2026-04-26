import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../../../fsarch/auth/guards/auth.guard";
import { Roles } from "../../../fsarch/uac/decorators/roles.decorator";
import { Role } from "../../../fsarch/auth/role.enum";
import { PathRuleService } from "./path-rule.service";
import { PathRuleCreateDto, PathRuleDto, PathRuleUpdateDto } from "../../../models/path-rule.model";

@ApiTags('path-rules')
@Controller({
  path: 'domain-groups/:domainGroupId/path-rules',
  version: '1',
})
@ApiBearerAuth()
export class PathRuleController {
  constructor(
    private readonly pathRuleService: PathRuleService,
  ) {
  }

  @Post()
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async Create(
    @Body() pathRuleCreateDto: PathRuleCreateDto,
    @Param('domainGroupId') domainGroupId: string,
  ) {
    return await this.pathRuleService.Create(
      domainGroupId,
      pathRuleCreateDto,
    );
  }

  @Get()
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async List(
    @Param('domainGroupId') domainGroupId: string,
  ) {
    const pathRules = await this.pathRuleService.ListByDomainGroupId(
      domainGroupId,
    );

    return pathRules.map(PathRuleDto.FromDbo);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async GetById(
    @Param('id') id: string,
  ) {
    const pathRule = await this.pathRuleService.GetById(id);
    return PathRuleDto.FromDbo(pathRule);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async Update(
    @Param('id') id: string,
    @Body() pathRuleUpdateDto: PathRuleUpdateDto,
  ) {
    const updated = await this.pathRuleService.Update(id, pathRuleUpdateDto);
    return PathRuleDto.FromDbo(updated);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async Delete(
    @Param('id') id: string,
  ) {
    await this.pathRuleService.Delete(id);
  }
}
