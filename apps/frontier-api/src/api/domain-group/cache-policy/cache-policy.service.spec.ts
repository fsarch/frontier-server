import { Test, TestingModule } from '@nestjs/testing';
import { CachePolicyService } from './cache-policy.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CachePolicy } from '../../../database/entities/cache-policy.entity.js';

describe('CachePolicyService', () => {
  let service: CachePolicyService;

  const mockCachePolicyRepository = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CachePolicyService,
        {
          provide: getRepositoryToken(CachePolicy),
          useValue: mockCachePolicyRepository,
        },
      ],
    }).compile();

    service = module.get<CachePolicyService>(CachePolicyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
