import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PathRule } from '../../../database/entities/path-rule.entity.js';
import {
  RateLimitKeyType,
  RateLimitPolicy,
} from '../../../database/entities/rate-limit-policy.entity.js';
import {
  RATE_LIMIT_KEY_TYPES,
  RateLimitPolicyCreateDto,
  RateLimitPolicyUpdateDto,
} from '../../../models/rate-limit-policy.model.js';

const DEFAULT_WINDOW_SECONDS = 60;

@Injectable()
export class RateLimitPolicyService {
  constructor(
    @InjectRepository(RateLimitPolicy)
    private readonly rateLimitPolicyRepository: Repository<RateLimitPolicy>,
    @InjectRepository(PathRule)
    private readonly pathRuleRepository: Repository<PathRule>,
  ) {}

  public async Create(domainGroupId: string, dto: RateLimitPolicyCreateDto) {
    if (!dto.name) {
      throw new BadRequestException('name is required');
    }

    const createdPolicy = this.rateLimitPolicyRepository.create({
      id: crypto.randomUUID(),
      domainGroupId,
      name: dto.name,
      enabled: dto.enabled === true,
      limit: validatePositiveInteger('limit', dto.limit),
      windowSeconds: validatePositiveInteger(
        'windowSeconds',
        dto.windowSeconds ?? DEFAULT_WINDOW_SECONDS,
      ),
      keyType: validateKeyType(dto.keyType ?? 'ip'),
    });

    const savedPolicy =
      await this.rateLimitPolicyRepository.save(createdPolicy);

    return {
      id: savedPolicy.id,
    };
  }

  public async ListByDomainGroupId(domainGroupId: string) {
    return this.rateLimitPolicyRepository.find({
      where: { domainGroupId },
    });
  }

  public async List() {
    return this.rateLimitPolicyRepository.find();
  }

  public async GetById(id: string, domainGroupId: string) {
    const policy = await this.rateLimitPolicyRepository.findOne({
      where: {
        id,
        domainGroupId,
      },
    });

    if (!policy) {
      throw new NotFoundException(`RateLimitPolicy ${id} not found`);
    }

    return policy;
  }

  public async Update(
    id: string,
    domainGroupId: string,
    dto: RateLimitPolicyUpdateDto,
  ) {
    const policy = await this.GetById(id, domainGroupId);

    if (dto.name !== undefined) {
      if (!dto.name) {
        throw new BadRequestException('name must not be empty');
      }
      policy.name = dto.name;
    }

    if (dto.enabled !== undefined) {
      policy.enabled = dto.enabled;
    }

    if (dto.limit !== undefined) {
      policy.limit = validatePositiveInteger('limit', dto.limit);
    }

    if (dto.windowSeconds !== undefined) {
      policy.windowSeconds = validatePositiveInteger(
        'windowSeconds',
        dto.windowSeconds,
      );
    }

    if (dto.keyType !== undefined) {
      policy.keyType = validateKeyType(dto.keyType);
    }

    return this.rateLimitPolicyRepository.save(policy);
  }

  public async Delete(id: string, domainGroupId: string) {
    const policy = await this.GetById(id, domainGroupId);

    await this.pathRuleRepository.query(
      'UPDATE path_rule SET rate_limit_policy_id = NULL WHERE domain_group_id = $1 AND rate_limit_policy_id = $2',
      [domainGroupId, policy.id],
    );

    await this.rateLimitPolicyRepository.softDelete(policy.id);
  }
}

function validatePositiveInteger(field: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new BadRequestException(`${field} must be an integer >= 1`);
  }

  return value;
}

function validateKeyType(value: unknown): RateLimitKeyType {
  if (!RATE_LIMIT_KEY_TYPES.includes(value as RateLimitKeyType)) {
    throw new BadRequestException(
      `keyType must be one of: ${RATE_LIMIT_KEY_TYPES.join(', ')}`,
    );
  }

  return value as RateLimitKeyType;
}
