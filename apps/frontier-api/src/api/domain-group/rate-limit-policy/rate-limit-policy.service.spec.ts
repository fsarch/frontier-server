import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PathRule } from '../../../database/entities/path-rule.entity.js';
import { RateLimitPolicy } from '../../../database/entities/rate-limit-policy.entity.js';
import { RateLimitPolicyService } from './rate-limit-policy.service';

describe('RateLimitPolicyService', () => {
  let service: RateLimitPolicyService;

  const mockRateLimitPolicyRepository = {
    create: vi.fn((value) => value),
    save: vi.fn(async (value) => value),
    findOne: vi.fn(),
    softDelete: vi.fn(),
  };
  const mockPathRuleRepository = {
    query: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitPolicyService,
        {
          provide: getRepositoryToken(RateLimitPolicy),
          useValue: mockRateLimitPolicyRepository,
        },
        {
          provide: getRepositoryToken(PathRule),
          useValue: mockPathRuleRepository,
        },
      ],
    }).compile();

    service = module.get<RateLimitPolicyService>(RateLimitPolicyService);
  });

  it('creates a policy with defaults', async () => {
    await service.Create('dg-1', { name: 'api', limit: 100 });

    expect(mockRateLimitPolicyRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        domainGroupId: 'dg-1',
        name: 'api',
        enabled: false,
        limit: 100,
        windowSeconds: 60,
        keyType: 'ip',
      }),
    );
  });

  it.each([{ limit: 0 }, { limit: -1 }, { limit: 1.5 }, { limit: undefined }])(
    'rejects invalid limit %o',
    async ({ limit }) => {
      await expect(
        service.Create('dg-1', { name: 'api', limit: limit as number }),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('rejects invalid windowSeconds', async () => {
    await expect(
      service.Create('dg-1', { name: 'api', limit: 10, windowSeconds: 0 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unsupported keyType', async () => {
    await expect(
      service.Create('dg-1', {
        name: 'api',
        limit: 10,
        keyType: 'header' as never,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates fields on update', async () => {
    mockRateLimitPolicyRepository.findOne.mockResolvedValue({
      id: 'rl-1',
      domainGroupId: 'dg-1',
      limit: 10,
      windowSeconds: 60,
    });

    await expect(
      service.Update('rl-1', 'dg-1', { limit: 0 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const updated = await service.Update('rl-1', 'dg-1', {
      limit: 20,
      enabled: true,
    });
    expect(updated).toEqual(
      expect.objectContaining({ limit: 20, enabled: true, windowSeconds: 60 }),
    );
  });

  it('throws NotFound for unknown policy', async () => {
    mockRateLimitPolicyRepository.findOne.mockResolvedValue(null);

    await expect(service.GetById('missing', 'dg-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('detaches path rules on delete', async () => {
    mockRateLimitPolicyRepository.findOne.mockResolvedValue({
      id: 'rl-1',
      domainGroupId: 'dg-1',
    });

    await service.Delete('rl-1', 'dg-1');

    expect(mockPathRuleRepository.query).toHaveBeenCalledWith(
      expect.stringContaining('rate_limit_policy_id = NULL'),
      ['dg-1', 'rl-1'],
    );
    expect(mockRateLimitPolicyRepository.softDelete).toHaveBeenCalledWith(
      'rl-1',
    );
  });
});
