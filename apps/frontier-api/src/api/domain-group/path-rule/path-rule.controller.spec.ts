import { Test, TestingModule } from '@nestjs/testing';
import { PathRuleController } from './path-rule.controller';
import { PathRuleService } from './path-rule.service';
import { AuthGuard } from '@fsarch/server/auth';
import { Reflector } from '@nestjs/core';

describe.skip('PathRuleController', () => {
  let controller: PathRuleController;

  const mockPathRuleService = {};
  const mockAuthGuard = { canActivate: vi.fn().mockReturnValue(true) };
  const mockReflector = new Reflector();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PathRuleController],
      providers: [
        {
          provide: PathRuleService,
          useValue: mockPathRuleService,
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

    controller = module.get<PathRuleController>(PathRuleController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
