import { Injectable } from '@nestjs/common';
import { PathRuleCreateDto } from "../../../models/path-rule.model.js";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UpstreamGroup } from "../../../database/entities/upstream-group.entity.js";
import { UpstreamGroupCreateDto, UpstreamGroupUpdateDto } from "../../../models/upstream-group.model.js";

@Injectable()
export class UpstreamGroupService {
  constructor(
    @InjectRepository(UpstreamGroup)
    private readonly upstreamGroupRepository: Repository<UpstreamGroup>,
  ) {
  }


  public async Create(
    domainGroupId: string,
    upstreamGroupDto: UpstreamGroupCreateDto,
  ) {
    const createdUpstreamGroup = this.upstreamGroupRepository.create({
      id: crypto.randomUUID(),
      domainGroupId,
      ...upstreamGroupDto,
    });

    const savedUpstreamGroup = await this.upstreamGroupRepository.save(createdUpstreamGroup);

    return {
      id: savedUpstreamGroup.id,
    };
  }

  public async ListByDomainGroupId(
    domainGroupId: string,
  ) {
    return this.upstreamGroupRepository.find({
      where: { domainGroupId },
    });
  }

  public async List() {
    return this.upstreamGroupRepository.find();
  }

  public async GetById(
    id: string,
  ) {
    return this.upstreamGroupRepository.findOne({ where: { id } });
  }

  public async Update(
    id: string,
    upstreamGroupDto: UpstreamGroupUpdateDto,
  ) {
    const existingUpstreamGroup = await this.upstreamGroupRepository.findOne({ where: { id } });
    if (!existingUpstreamGroup) {
      return null;
    }

    await this.upstreamGroupRepository.update(id, {
      name: upstreamGroupDto.name ?? existingUpstreamGroup.name,
    });

    return this.upstreamGroupRepository.findOne({ where: { id } });
  }

  public async Delete(
    id: string,
  ) {
    const existingUpstreamGroup = await this.upstreamGroupRepository.findOne({ where: { id } });
    if (!existingUpstreamGroup) {
      return false;
    }

    await this.upstreamGroupRepository.softRemove(existingUpstreamGroup);
    return true;
  }
}
