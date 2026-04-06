import { Injectable } from '@nestjs/common';
import { DomainGroupDomainCreateDto, DomainGroupDomainDto } from "../../../models/domain-group-domain.model";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DomainGroupDomain } from "../../../database/entities/domain-group-domain.entity";

@Injectable()
export class DomainService {
  constructor(
    @InjectRepository(DomainGroupDomain)
    private domainGroupDomainRepository: Repository<DomainGroupDomain>,
  ) {
  }

  public async Create(
    domainGroupId: string,
    domainDto: DomainGroupDomainCreateDto,
  ) {
    const createdDomain = this.domainGroupDomainRepository.create({
      id: crypto.randomUUID(),
      domainGroupId,
      ...domainDto,
    });

    const savedDomain = await this.domainGroupDomainRepository.save(createdDomain);

    return {
      id: savedDomain.id,
    };
  }

  public async ListByDomainGroupId(
    domainGroupId: string,
  ) {
    return this.domainGroupDomainRepository.find({
      where: { domainGroupId },
    });
  }

  public async List() {
    return this.domainGroupDomainRepository.find();
  }
}
