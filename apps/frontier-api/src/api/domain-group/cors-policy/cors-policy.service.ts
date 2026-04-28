import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CorsPolicy } from '../../../database/entities/cors-policy.entity';
import { CorsPolicyCreateDto, CorsPolicyUpdateDto } from '../../../models/cors-policy.model';
import { PathRule } from '../../../database/entities/path-rule.entity';

@Injectable()
export class CorsPolicyService {
  constructor(
    @InjectRepository(CorsPolicy)
    private readonly corsPolicyRepository: Repository<CorsPolicy>,
    @InjectRepository(PathRule)
    private readonly pathRuleRepository: Repository<PathRule>,
  ) {
  }

  public async Create(domainGroupId: string, dto: CorsPolicyCreateDto) {
    const createdCorsPolicy = this.corsPolicyRepository.create({
      id: crypto.randomUUID(),
      domainGroupId,
      name: dto.name,
      enabled: dto.enabled === true,
      allowCredentials: dto.allowCredentials === true,
      allowedOrigins: normalizeAllowedOrigins(dto.allowedOrigins),
    });

    const savedCorsPolicy = await this.corsPolicyRepository.save(createdCorsPolicy);

    return {
      id: savedCorsPolicy.id,
    };
  }

  public async ListByDomainGroupId(domainGroupId: string) {
    return this.corsPolicyRepository.find({
      where: { domainGroupId },
    });
  }

  public async List() {
    return this.corsPolicyRepository.find();
  }

  public async GetById(id: string, domainGroupId: string): Promise<CorsPolicy> {
    const corsPolicy = await this.corsPolicyRepository.findOne({
      where: { id, domainGroupId },
    });

    if (!corsPolicy) {
      throw new NotFoundException(`CorsPolicy ${id} not found`);
    }

    return corsPolicy;
  }

  public async Update(id: string, domainGroupId: string, dto: CorsPolicyUpdateDto): Promise<CorsPolicy> {
    const corsPolicy = await this.GetById(id, domainGroupId);

    if (dto.name !== undefined) {
      corsPolicy.name = dto.name;
    }

    if (dto.enabled !== undefined) {
      corsPolicy.enabled = dto.enabled;
    }

    if (dto.allowCredentials !== undefined) {
      corsPolicy.allowCredentials = dto.allowCredentials;
    }

    if (dto.allowedOrigins !== undefined) {
      corsPolicy.allowedOrigins = normalizeAllowedOrigins(dto.allowedOrigins);
    }

    return this.corsPolicyRepository.save(corsPolicy);
  }

  public async Delete(id: string, domainGroupId: string): Promise<void> {
    const corsPolicy = await this.GetById(id, domainGroupId);

    await this.pathRuleRepository
      .createQueryBuilder()
      .update(PathRule)
      .set({ corsPolicyId: null })
      .where('domain_group_id = :domainGroupId', { domainGroupId })
      .andWhere('cors_policy_id = :corsPolicyId', { corsPolicyId: corsPolicy.id })
      .execute();

    await this.corsPolicyRepository.softDelete(corsPolicy.id);
  }
}

function normalizeAllowedOrigins(origins: string[] | undefined): string[] {
  return (origins ?? [])
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

