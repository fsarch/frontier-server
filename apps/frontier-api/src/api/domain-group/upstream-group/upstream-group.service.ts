import { Injectable } from '@nestjs/common';
import { PathRuleCreateDto } from "../../../models/path-rule.model";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UpstreamGroup } from "../../../database/entities/upstream-group.entity";
import { UpstreamGroupCreateDto } from "../../../models/upstream-group.model";

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
}
