import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DomainGroup } from '../../database/entities/domain-group.entity.js';
import { DomainGroupService } from './domain-group.service';

describe('DomainGroupService', () => {
  let service: DomainGroupService;

  const mockDomainGroupRepository = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DomainGroupService,
        {
          provide: getRepositoryToken(DomainGroup),
          useValue: mockDomainGroupRepository,
        },
      ],
    }).compile();

    service = module.get<DomainGroupService>(DomainGroupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
