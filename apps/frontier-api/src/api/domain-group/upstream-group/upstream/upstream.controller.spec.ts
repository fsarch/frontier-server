import { Test, TestingModule } from '@nestjs/testing';
import { UpstreamController } from './upstream.controller';
import { UpstreamService } from './upstream.service';
import { AuthGuard } from '@fsarch/server/auth';
import { Reflector } from '@nestjs/core';

describe.skip('UpstreamController', () => {
  let controller: UpstreamController;

  const mockUpstreamService = {};
  const mockAuthGuard = { canActivate: vi.fn().mockReturnValue(true) };
  const mockReflector = new Reflector();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UpstreamController],
      providers: [
        {
          provide: UpstreamService,
          useValue: mockUpstreamService,
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

    controller = module.get<UpstreamController>(UpstreamController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
