import { Test, TestingModule } from '@nestjs/testing';
import { WebsocketGateway } from './websocket.gateway';
import { DomainGroupService } from '../../domain-group/domain-group.service';
import { DomainService } from '../../domain-group/domain/domain.service';
import { CachePolicyService } from '../../domain-group/cache-policy/cache-policy.service';
import { UpstreamGroupService } from '../../domain-group/upstream-group/upstream-group.service';
import { UpstreamService } from '../../domain-group/upstream-group/upstream/upstream.service';
import { PathRuleService } from '../../domain-group/path-rule/path-rule.service';
import { WorkerBootstrapService } from '../worker-bootstrap.service';

describe('WebsocketGateway', () => {
  let gateway: WebsocketGateway;

  const mockWorkerBootstrapService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebsocketGateway,
        {
          provide: 'WORKERS_CONFIG',
          useValue: {
            get: vi.fn().mockReturnValue({
              websocket: {
                auth_token: 'Test',
                config_check_interval_ms: 2000,
              },
            }),
          },
        },
        { provide: WorkerBootstrapService, useValue: mockWorkerBootstrapService },
        { provide: DomainGroupService, useValue: { List: vi.fn().mockResolvedValue([]) } },
        { provide: DomainService, useValue: { List: vi.fn().mockResolvedValue([]) } },
        { provide: CachePolicyService, useValue: { List: vi.fn().mockResolvedValue([]) } },
        { provide: UpstreamGroupService, useValue: { List: vi.fn().mockResolvedValue([]) } },
        { provide: UpstreamService, useValue: { List: vi.fn().mockResolvedValue([]) } },
        { provide: PathRuleService, useValue: { List: vi.fn().mockResolvedValue([]) } },
      ],
    }).compile();

    gateway = module.get<WebsocketGateway>(WebsocketGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
