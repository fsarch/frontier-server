import { Injectable } from '@nestjs/common';
import { CachePolicyCreateDto, CachePolicyUpdateDto } from "../../../models/cache-policy.model";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CachePolicy } from "../../../database/entities/cache-policy.entity";
import { DomainGroupDomainCreateDto } from "../../../models/domain-group-domain.model";

@Injectable()
export class CachePolicyService {
  constructor(
    @InjectRepository(CachePolicy)
    private readonly cachePolicyRepository: Repository<CachePolicy>,
  ) {
  }

  async Create(
    domainGroupId: string,
    cachePolicyCreateDto: CachePolicyCreateDto,
  ) {
    const createdCachePolicy = this.cachePolicyRepository.create({
      id: crypto.randomUUID(),
      domainGroupId,
      ...cachePolicyCreateDto,
    });

    const savedCachePolicy = await this.cachePolicyRepository.save(createdCachePolicy);

    return {
      id: savedCachePolicy.id,
    };
  }

  public async ListByDomainGroupId(
    domainGroupId: string,
  ) {
    return this.cachePolicyRepository.find({
      where: { domainGroupId },
    });
  }

  public async List() {
    return this.cachePolicyRepository.find();
  }

  public async Update(
    id: string,
    domainGroupId: string,
    updateDto: CachePolicyUpdateDto,
  ) {
    await this.cachePolicyRepository.update({
      id,
      domainGroupId,
    }, updateDto);
  }
}
