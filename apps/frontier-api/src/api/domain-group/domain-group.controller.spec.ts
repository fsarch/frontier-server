import { Test, TestingModule } from '@nestjs/testing';
import { DomainGroupController } from './domain-group.controller';
import { DomainGroupService } from './domain-group.service';
import { AuthGuard } from '@fsarch/server/auth';
import { Reflector } from '@nestjs/core';

describe.skip('DomainGroupController', () => {
  let controller: DomainGroupController;

  const mockDomainGroupService = {};
  const mockAuthGuard = { canActivate: vi.fn().mockReturnValue(true) };
  const mockReflector = new Reflector();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DomainGroupController],
      providers: [
        {
          provide: DomainGroupService,
          useValue: mockDomainGroupService,
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

    controller = module.get<DomainGroupController>(DomainGroupController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
