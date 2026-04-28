import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../../fsarch/auth/guards/auth.guard';
import { Roles } from '../../../fsarch/uac/decorators/roles.decorator';
import { Role } from '../../../fsarch/auth/role.enum';
import { CorsPolicyService } from './cors-policy.service';
import { CorsPolicyCreateDto, CorsPolicyDto, CorsPolicyUpdateDto } from '../../../models/cors-policy.model';

@ApiTags('cors-policies')
@Controller({
  path: 'domain-groups/:domainGroupId/cors-policies',
  version: '1',
})
@ApiBearerAuth()
export class CorsPolicyController {
  constructor(
    private readonly corsPolicyService: CorsPolicyService,
  ) {
  }

  @Post()
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async Create(
    @Body() corsPolicyCreateDto: CorsPolicyCreateDto,
    @Param('domainGroupId') domainGroupId: string,
  ) {
    return this.corsPolicyService.Create(domainGroupId, corsPolicyCreateDto);
  }

  @Get()
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async List(
    @Param('domainGroupId') domainGroupId: string,
  ) {
    const corsPolicies = await this.corsPolicyService.ListByDomainGroupId(domainGroupId);

    return corsPolicies.map(CorsPolicyDto.FromDbo);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async GetById(
    @Param('domainGroupId') domainGroupId: string,
    @Param('id') id: string,
  ) {
    const corsPolicy = await this.corsPolicyService.GetById(id, domainGroupId);

    return CorsPolicyDto.FromDbo(corsPolicy);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async Update(
    @Param('domainGroupId') domainGroupId: string,
    @Param('id') id: string,
    @Body() corsPolicyUpdateDto: CorsPolicyUpdateDto,
  ) {
    const updated = await this.corsPolicyService.Update(id, domainGroupId, corsPolicyUpdateDto);

    return CorsPolicyDto.FromDbo(updated);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async Delete(
    @Param('domainGroupId') domainGroupId: string,
    @Param('id') id: string,
  ) {
    await this.corsPolicyService.Delete(id, domainGroupId);
  }
}

