import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway
} from '@nestjs/websockets';
import { Inject, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { WebSocket } from "ws";
import { createHash } from "crypto";
import { DomainGroupService } from "../../domain-group/domain-group.service";
import { DomainService } from "../../domain-group/domain/domain.service";
import { CachePolicyService } from "../../domain-group/cache-policy/cache-policy.service";
import { UpstreamGroupService } from "../../domain-group/upstream-group/upstream-group.service";
import { UpstreamService } from "../../domain-group/upstream-group/upstream/upstream.service";
import { PathRuleService } from "../../domain-group/path-rule/path-rule.service";
import { UpstreamGroup } from "../../../database/entities/upstream-group.entity";
import { Upstream } from "../../../database/entities/upstream.entity";
import { DomainGroup } from "../../../database/entities/domain-group.entity";
import { PathRule } from "../../../database/entities/path-rule.entity";
import { DomainGroupDomain } from "../../../database/entities/domain-group-domain.entity";
import { CachePolicy } from "../../../database/entities/cache-policy.entity";
import { ModuleConfigurationService } from '../../../fsarch/configuration/module/module-configuration.service';
import { ConfigWorkersType } from '../../../fsarch/configuration/config.type';

type WebSocketResponseMessage<T> = {
  replyTo: string;
  payload: T;
};

type WorkerConfigSnapshot = {
  domainGroups: TEntity<DomainGroup & { pathRules: Array<PathRule> }>;
  domainGroupDomainsByDomain: TEntity<DomainGroupDomain>;
  cachePolicies: TEntity<CachePolicy>;
  upstreamGroups: TEntity<UpstreamGroup & { upstreams: Array<Upstream> }>;
};

type TEntity<T> = {
  entities: Record<string, T>;
  ids: Array<string>;
}

function toEntityGroup<T>(data: Array<T>, selectId: (value: T) => string): { entities: Record<string, T>; ids: Array<string> } {
  const entities = {};
  const entityIds = [];

  data.forEach(entity => {
    const id = selectId(entity);

    entities[id] = entity;
    entityIds.push(id);
  });

  return {
    entities,
    ids: entityIds,
  };
}

@WebSocketGateway({
  transports: 'websocket',
  path: '/api/workers/websocket'
})
export class WebsocketGateway implements OnGatewayConnection, OnModuleInit, OnModuleDestroy {
  private readonly clients = new Set<WebSocket>();
  private configVersion = 0;
  private configChecksum = '';
  private configCheckInterval: NodeJS.Timeout;

  constructor(
    @Inject('WORKERS_CONFIG')
    private readonly workersConfigService: ModuleConfigurationService<ConfigWorkersType>,
    private readonly domainGroupService: DomainGroupService,
    private readonly domainGroupDomainService: DomainService,
    private readonly cachePolicyService: CachePolicyService,
    private readonly upstreamGroupService: UpstreamGroupService,
    private readonly upstreamService: UpstreamService,
    private readonly pathRuleService: PathRuleService,
  ) {
  }

  private get configCheckIntervalMs() {
    return this.workersConfigService.get('websocket').config_check_interval_ms;
  }

  private get workerAuthToken() {
    return this.workersConfigService.get('websocket').auth_token;
  }

  public onModuleInit() {
    this.syncAndBroadcastConfig(false)
      .catch(() => null);

    this.configCheckInterval = setInterval(() => {
      this.syncAndBroadcastConfig(false)
        .catch(() => null);
    }, this.configCheckIntervalMs);
  }

  public onModuleDestroy() {
    if (this.configCheckInterval) {
      clearInterval(this.configCheckInterval);
    }
  }

  private async buildSnapshot(): Promise<WorkerConfigSnapshot> {
    const [
      domainGroups,
      domainGroupDomains,
      cachePolicies,
      upstreamGroups,
      upstreams,
      pathRules,
    ] = await Promise.all([
      this.domainGroupService.List(),
      this.domainGroupDomainService.List(),
      this.cachePolicyService.List(),
      this.upstreamGroupService.List(),
      this.upstreamService.List(),
      this.pathRuleService.List(),
    ]);

    const upstreamGroupsEntity = toEntityGroup(upstreamGroups as Array<UpstreamGroup & { upstreams: Array<Upstream> }>, (upstreamGroup) => upstreamGroup.id);
    upstreams.forEach((upstream) => {
      if (!upstreamGroupsEntity.entities[upstream.upstreamGroupId]) {
        return;
      }

      upstreamGroupsEntity.entities[upstream.upstreamGroupId].upstreams ??= [];
      upstreamGroupsEntity.entities[upstream.upstreamGroupId].upstreams.push(upstream);
    });

    const domainGroupsEntity = toEntityGroup(domainGroups as Array<DomainGroup & { pathRules: Array<PathRule> }>, (domainGroup) => domainGroup.id);
    pathRules.forEach((pathRule) => {
      if (!domainGroupsEntity.entities[pathRule.domainGroupId]) {
        return;
      }

      domainGroupsEntity.entities[pathRule.domainGroupId].pathRules ??= [];
      domainGroupsEntity.entities[pathRule.domainGroupId].pathRules.push(pathRule);
    });

    return {
      domainGroups: domainGroupsEntity,
      domainGroupDomainsByDomain: toEntityGroup(domainGroupDomains, (domainGroupDomain) => domainGroupDomain.domainName),
      cachePolicies: toEntityGroup(cachePolicies, (cachePolicy) => cachePolicy.id),
      upstreamGroups: upstreamGroupsEntity,
    };
  }

  private getSnapshotChecksum(snapshot: WorkerConfigSnapshot): string {
    return createHash('sha256')
      .update(JSON.stringify(snapshot))
      .digest('hex');
  }

  private async syncAndBroadcastConfig(force: boolean): Promise<void> {
    if (this.clients.size === 0 && !force) {
      return;
    }

    const snapshot = await this.buildSnapshot();
    const checksum = this.getSnapshotChecksum(snapshot);

    if (!force && checksum === this.configChecksum) {
      return;
    }

    this.configChecksum = checksum;
    this.configVersion += 1;

    const message = JSON.stringify({
      type: 'CONFIG_SNAPSHOT',
      version: this.configVersion,
      checksum,
      payload: snapshot,
    });

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  public handleConnection(client: WebSocket) {
    const unauthorized = () => {
      client.send(JSON.stringify({
        event: 'UNAUTHORIZED',
      }));
      client.close();
    };

    const timeout = setTimeout(() => {
      unauthorized();
    }, 5000);

    const handleMessage = (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());

        if (data?.event !== 'auth' || data?.data !== this.workerAuthToken) {
          unauthorized();
          return;
        }

        clearTimeout(timeout);
        client.off('message', handleMessage);
        this.clients.add(client);
      } catch {
        unauthorized();
      }
    };

    client.on('message', handleMessage);

    client.on('close', () => {
      this.clients.delete(client);
      client.off('message', handleMessage);
      clearTimeout(timeout);
    });
  }

  @SubscribeMessage('bootstrap')
  async handleMessage(client: any, payload: { id: string }): Promise<WebSocketResponseMessage<{
    version: number;
    checksum: string;
    snapshot: WorkerConfigSnapshot;
  }>> {
    const snapshot = await this.buildSnapshot();
    const checksum = this.getSnapshotChecksum(snapshot);

    if (checksum !== this.configChecksum) {
      this.configChecksum = checksum;
      this.configVersion += 1;
    }

    return {
      payload: {
        version: this.configVersion,
        checksum: this.configChecksum,
        snapshot,
      },
      replyTo: payload.id,
    };
  }

  @SubscribeMessage('heartbeat')
  handleHeartbeat(client: any, payload: { id: string }) {
    return {
      replyTo: payload.id,
      payload: {
        ok: true,
        serverTime: Date.now(),
      },
    };
  }
}
