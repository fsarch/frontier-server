import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from '@fsarch/server/auth';
import { Roles } from '@fsarch/server/uac';
import { HookService } from "./hook.service.js";
import { HookCreateDto, HookDto, HookUpdateDto } from "../../models/hook.model.js";
import { Role } from "../../constants/role.enum.js";

@ApiTags('hooks')
@Controller({
  path: 'hooks',
  version: '1',
})
@ApiBearerAuth()
export class HookController {
  constructor(
    private readonly hookService: HookService,
  ) {
  }

  @Post()
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async Create(
    @Body() hookCreateDto: HookCreateDto,
  ) {
    const result = await this.hookService.Create(hookCreateDto);
    return HookDto.FromDbo({ ...hookCreateDto, ...result });
  }

  @Get()
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async List() {
    const hooks = await this.hookService.List();
    return hooks.map(HookDto.FromDbo);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async GetById(
    @Param('id') id: string,
  ) {
    const hook = await this.hookService.GetById(id);
    return HookDto.FromDbo(hook);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async Update(
    @Param('id') id: string,
    @Body() hookUpdateDto: HookUpdateDto,
  ) {
    const updated = await this.hookService.Update(id, hookUpdateDto);
    return HookDto.FromDbo(updated);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  @Roles(Role.manage)
  public async Delete(
    @Param('id') id: string,
  ) {
    await this.hookService.Delete(id);
  }
}
