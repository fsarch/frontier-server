import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LogPolicy } from '../../../database/entities/log-policy.entity';
import { LogPolicyCreateDto, LogPolicyUpdateDto } from '../../../models/log-policy.model';
import { PathRule } from '../../../database/entities/path-rule.entity';

@Injectable()
export class LogPolicyService {
  constructor(
    @InjectRepository(LogPolicy)
    private readonly logPolicyRepository: Repository<LogPolicy>,
    @InjectRepository(PathRule)
    private readonly pathRuleRepository: Repository<PathRule>,
  ) {
  }

  public async Create(domainGroupId: string, dto: LogPolicyCreateDto) {
    const createdLogPolicy = this.logPolicyRepository.create({
      id: crypto.randomUUID(),
      domainGroupId,
      name: dto.name,
      enabled: dto.enabled === true,
      retentionTimeSeconds: normalizeRetentionTime(dto.retentionTimeSeconds),
    });

    const savedLogPolicy = await this.logPolicyRepository.save(createdLogPolicy);

    return {
      id: savedLogPolicy.id,
    };
  }

  public async ListByDomainGroupId(domainGroupId: string) {
    return this.logPolicyRepository.find({
      where: { domainGroupId },
    });
  }

  public async List() {
    return this.logPolicyRepository.find();
  }

  public async GetById(id: string, domainGroupId: string) {
    const policy = await this.logPolicyRepository.findOne({
      where: {
        id,
        domainGroupId,
      },
    });

    if (!policy) {
      throw new NotFoundException(`LogPolicy ${id} not found`);
    }

    return policy;
  }

  public async Update(id: string, domainGroupId: string, dto: LogPolicyUpdateDto) {
    const policy = await this.GetById(id, domainGroupId);

    if (dto.name !== undefined) {
      policy.name = dto.name;
    }

    if (dto.enabled !== undefined) {
      policy.enabled = dto.enabled;
    }

    if (dto.retentionTimeSeconds !== undefined) {
      policy.retentionTimeSeconds = normalizeRetentionTime(dto.retentionTimeSeconds);
    }

    return this.logPolicyRepository.save(policy);
  }

  public async Delete(id: string, domainGroupId: string) {
    const policy = await this.GetById(id, domainGroupId);

    await this.pathRuleRepository.query(
      'UPDATE path_rule SET log_policy_id = NULL WHERE domain_group_id = $1 AND log_policy_id = $2',
      [domainGroupId, policy.id],
    );

    await this.logPolicyRepository.softDelete(policy.id);
  }
}

function normalizeRetentionTime(value: number | undefined): number {
  if (!value || value <= 0) {
    return 604800;
  }

  return Math.floor(value);
}

