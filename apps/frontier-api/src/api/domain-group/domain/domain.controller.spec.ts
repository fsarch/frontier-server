import { Test, TestingModule } from '@nestjs/testing';
import { DomainController } from './domain.controller';
import { DomainService } from './domain.service';
import { AuthGuard } from '@fsarch/server/auth';
import { Reflector } from '@nestjs/core';

describe.skip('DomainController', () => {
  let controller: DomainController;

  const mockDomainService = {};
  const mockAuthGuard = { canActivate: vi.fn().mockReturnValue(true) };
  const mockReflector = new Reflector();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DomainController],
      providers: [
        {
          provide: DomainService,
          useValue: mockDomainService,
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

    controller = module.get<DomainController>(DomainController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
