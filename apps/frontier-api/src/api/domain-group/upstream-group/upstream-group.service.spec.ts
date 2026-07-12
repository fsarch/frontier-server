import { Test, TestingModule } from '@nestjs/testing';
import { UpstreamGroupService } from './upstream-group.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UpstreamGroup } from '../../../database/entities/upstream-group.entity.js';

describe('UpstreamGroupService', () => {
  let service: UpstreamGroupService;

  const mockUpstreamGroupRepository = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpstreamGroupService,
        {
          provide: getRepositoryToken(UpstreamGroup),
          useValue: mockUpstreamGroupRepository,
        },
      ],
    }).compile();

    service = module.get<UpstreamGroupService>(UpstreamGroupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
