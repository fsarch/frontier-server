import { Test, TestingModule } from '@nestjs/testing';
import { UpstreamGroupController } from './upstream-group.controller';
import { UpstreamGroupService } from './upstream-group.service';
import { AuthGuard } from '@fsarch/server/auth';
import { Reflector } from '@nestjs/core';

describe.skip('UpstreamGroupController', () => {
  let controller: UpstreamGroupController;

  const mockUpstreamGroupService = {};
  const mockAuthGuard = { canActivate: vi.fn().mockReturnValue(true) };
  const mockReflector = new Reflector();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UpstreamGroupController],
      providers: [
        {
          provide: UpstreamGroupService,
          useValue: mockUpstreamGroupService,
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

    controller = module.get<UpstreamGroupController>(UpstreamGroupController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
