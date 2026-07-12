import { Test, TestingModule } from '@nestjs/testing';
import { UpstreamService } from './upstream.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Upstream } from '../../../../database/entities/upstream.entity.js';
import { UpstreamSslOptions } from '../../../../database/entities/upstream-ssl-options.entity.js';

describe('UpstreamService', () => {
  let service: UpstreamService;

  const mockUpstreamRepository = {};
  const mockUpstreamSslOptionsRepository = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpstreamService,
        {
          provide: getRepositoryToken(Upstream),
          useValue: mockUpstreamRepository,
        },
        {
          provide: getRepositoryToken(UpstreamSslOptions),
          useValue: mockUpstreamSslOptionsRepository,
        },
      ],
    }).compile();

    service = module.get<UpstreamService>(UpstreamService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
