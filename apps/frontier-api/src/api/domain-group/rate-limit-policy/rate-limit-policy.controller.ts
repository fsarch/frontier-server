import { AuthGuard } from '@fsarch/server/auth';
import { Roles } from '@fsarch/server/uac';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../constants/role.enum.js';
import {
  RateLimitPolicyCreateDto,
  RateLimitPolicyDto,
  RateLimitPolicyUpdateDto,
} from '../../../models/rate-limit-policy.model.js';
import { RateLimitPolicyService } from './rate-limit-policy.service.js';

@ApiTags('rate-limit-policies')
@Controller({
  path: 'domain-groups/:domainGroupId/rate-limit-policies',
  version: '1',
})
@ApiBearerAuth()
export class RateLimitPolicyController {
  constructor(
    private readonly rateLimitPolicyService: RateLimitPolicyService,
  ) {}

  @Post()
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async Create(
    @Body() rateLimitPolicyCreateDto: RateLimitPolicyCreateDto,
    @Param('domainGroupId') domainGroupId: string,
  ) {
    return this.rateLimitPolicyService.Create(
      domainGroupId,
      rateLimitPolicyCreateDto,
    );
  }

  @Get()
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async List(@Param('domainGroupId') domainGroupId: string) {
    const policies =
      await this.rateLimitPolicyService.ListByDomainGroupId(domainGroupId);

    return policies.map(RateLimitPolicyDto.FromDbo);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async GetById(
    @Param('domainGroupId') domainGroupId: string,
    @Param('id') id: string,
  ) {
    const policy = await this.rateLimitPolicyService.GetById(id, domainGroupId);

    return RateLimitPolicyDto.FromDbo(policy);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async Update(
    @Param('domainGroupId') domainGroupId: string,
    @Param('id') id: string,
    @Body() rateLimitPolicyUpdateDto: RateLimitPolicyUpdateDto,
  ) {
    const updated = await this.rateLimitPolicyService.Update(
      id,
      domainGroupId,
      rateLimitPolicyUpdateDto,
    );

    return RateLimitPolicyDto.FromDbo(updated);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async Delete(
    @Param('domainGroupId') domainGroupId: string,
    @Param('id') id: string,
  ) {
    await this.rateLimitPolicyService.Delete(id, domainGroupId);
  }
}
