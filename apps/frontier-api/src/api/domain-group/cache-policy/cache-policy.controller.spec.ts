import { Test, TestingModule } from '@nestjs/testing';
import { CachePolicyController } from './cache-policy.controller';
import { CachePolicyService } from './cache-policy.service';
import { AuthGuard } from '@fsarch/server/auth';
import { Reflector } from '@nestjs/core';

describe.skip('CachePolicyController', () => {
  let controller: CachePolicyController;

  const mockCachePolicyService = {};
  const mockAuthGuard = { canActivate: vi.fn().mockReturnValue(true) };
  const mockReflector = new Reflector();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CachePolicyController],
      providers: [
        {
          provide: CachePolicyService,
          useValue: mockCachePolicyService,
        },
        {
          provide: AuthGuard,
          useValue: mockAuthGuard,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    controller = module.get<CachePolicyController>(CachePolicyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
