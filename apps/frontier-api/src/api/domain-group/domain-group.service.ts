import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainGroup } from '../../database/entities/domain-group.entity.js';
import {
  DomainGroupCreateDto,
  DomainGroupDto,
} from '../../models/domain-group.model.js';

@Injectable()
export class DomainGroupService {
  constructor(
    @InjectRepository(DomainGroup)
    private domainGroupRepository: Repository<DomainGroup>,
  ) {}

  public async Create(
    domainGroupDto: DomainGroupCreateDto,
  ): Promise<Pick<DomainGroupDto, 'id'>> {
    const createdDomainGroup = this.domainGroupRepository.create({
      id: crypto.randomUUID(),
      ...domainGroupDto,
    });

    const savedDomainGroup =
      await this.domainGroupRepository.save(createdDomainGroup);

    return {
      id: savedDomainGroup.id,
    };
  }

  public async List(): Promise<Array<DomainGroup>> {
    return await this.domainGroupRepository.find();
  }
}
