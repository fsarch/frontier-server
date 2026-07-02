import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Hook } from "../../database/entities/hook.entity.js";
import { HookCreateDto, HookUpdateDto } from "../../models/hook.model.js";

@Injectable()
export class HookService {
  constructor(
    @InjectRepository(Hook)
    private readonly hookRepository: Repository<Hook>,
  ) {
  }

  public async Create(hookDto: HookCreateDto) {
    const createdHook = this.hookRepository.create({
      id: crypto.randomUUID(),
      ...hookDto,
    });

    const savedHook = await this.hookRepository.save(createdHook);

    return {
      id: savedHook.id,
      creationTime: savedHook.creationTime,
      deletionTime: savedHook.deletionTime,
    };
  }

  public async List() {
    return this.hookRepository.find({
      order: {
        name: "ASC",
      },
    });
  }

  public async GetById(id: string): Promise<Hook> {
    const hook = await this.hookRepository.findOne({ where: { id } });

    if (!hook) {
      throw new NotFoundException(`Hook ${id} not found`);
    }

    return hook;
  }

  public async Update(id: string, dto: HookUpdateDto): Promise<Hook> {
    const hook = await this.GetById(id);

    Object.assign(hook, dto);

    return this.hookRepository.save(hook);
  }

  public async Delete(id: string): Promise<void> {
    const hook = await this.GetById(id);
    await this.hookRepository.softDelete(hook.id);
  }
}
