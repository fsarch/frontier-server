import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CorsPolicy } from '../../../database/entities/cors-policy.entity.js';
import { LogPolicy } from '../../../database/entities/log-policy.entity.js';
import { PathRule } from '../../../database/entities/path-rule.entity.js';
import { PathRuleService } from './path-rule.service';

describe('PathRuleService', () => {
  let service: PathRuleService;

  const mockPathRuleRepository = {};
  const mockCorsPolicyRepository = {};
  const mockLogPolicyRepository = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PathRuleService,
        {
          provide: getRepositoryToken(PathRule),
          useValue: mockPathRuleRepository,
        },
        {
          provide: getRepositoryToken(CorsPolicy),
          useValue: mockCorsPolicyRepository,
        },
        {
          provide: getRepositoryToken(LogPolicy),
          useValue: mockLogPolicyRepository,
        },
      ],
    }).compile();

    service = module.get<PathRuleService>(PathRuleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
