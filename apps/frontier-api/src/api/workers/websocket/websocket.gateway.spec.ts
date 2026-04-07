import { Test, TestingModule } from '@nestjs/testing';
import { WebsocketGateway } from './websocket.gateway';
import { DomainGroupService } from '../../domain-group/domain-group.service';
import { DomainService } from '../../domain-group/domain/domain.service';
import { CachePolicyService } from '../../domain-group/cache-policy/cache-policy.service';
import { UpstreamGroupService } from '../../domain-group/upstream-group/upstream-group.service';
import { UpstreamService } from '../../domain-group/upstream-group/upstream/upstream.service';
import { PathRuleService } from '../../domain-group/path-rule/path-rule.service';

describe('WebsocketGateway', () => {
  let gateway: WebsocketGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebsocketGateway,
        {
          provide: 'WORKERS_CONFIG',
          useValue: {
            get: jest.fn().mockReturnValue({
              websocket: {
                auth_token: 'Test',
                config_check_interval_ms: 2000,
              },
            }),
          },
        },
        { provide: DomainGroupService, useValue: { List: jest.fn().mockResolvedValue([]) } },
        { provide: DomainService, useValue: { List: jest.fn().mockResolvedValue([]) } },
        { provide: CachePolicyService, useValue: { List: jest.fn().mockResolvedValue([]) } },
        { provide: UpstreamGroupService, useValue: { List: jest.fn().mockResolvedValue([]) } },
        { provide: UpstreamService, useValue: { List: jest.fn().mockResolvedValue([]) } },
        { provide: PathRuleService, useValue: { List: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();

    gateway = module.get<WebsocketGateway>(WebsocketGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
