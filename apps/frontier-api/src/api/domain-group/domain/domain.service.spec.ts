import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DomainGroupDomain } from '../../../database/entities/domain-group-domain.entity.js';
import { DomainService } from './domain.service';

describe('DomainService', () => {
  let service: DomainService;

  const mockDomainGroupDomainRepository = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DomainService,
        {
          provide: getRepositoryToken(DomainGroupDomain),
          useValue: mockDomainGroupDomainRepository,
        },
      ],
    }).compile();

    service = module.get<DomainService>(DomainService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
