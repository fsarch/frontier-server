import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway
} from '@nestjs/websockets';
import { WebSocket } from "ws";
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

type WebSocketResponseMessage<T> = {
  replyTo: string;
  payload: T;
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
export class WebsocketGateway implements OnGatewayConnection {
  constructor(
    private readonly domainGroupService: DomainGroupService,
    private readonly domainGroupDomainService: DomainService,
    private readonly cachePolicyService: CachePolicyService,
    private readonly upstreamGroupService: UpstreamGroupService,
    private readonly upstreamService: UpstreamService,
    private readonly pathRuleService: PathRuleService,
  ) {
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

        if (data?.event !== 'auth' || data?.data !== 'Test') {
          unauthorized();
          return;
        }

        clearTimeout(timeout);
        client.off('message', handleMessage);
      } catch {
        unauthorized();
      }
    };

    client.on('message', handleMessage);

    client.on('close', () => {
      client.off('message', handleMessage);
      clearTimeout(timeout);
    });
  }

  @SubscribeMessage('bootstrap')
  async handleMessage(client: any, payload: { id: string }): Promise<WebSocketResponseMessage<{
    domainGroups: TEntity<DomainGroup & { pathRules: Array<PathRule> }>;
    domainGroupDomainsByDomain: TEntity<DomainGroupDomain>;
    cachePolicies: TEntity<CachePolicy>;
    upstreamGroups: TEntity<UpstreamGroup & { upstreams: Array<Upstream> }>;
  }>> {
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

    const data = {
      domainGroups: domainGroupsEntity,
      domainGroupDomainsByDomain: toEntityGroup(domainGroupDomains, (domainGroupDomain) => domainGroupDomain.domainName),
      cachePolicies: toEntityGroup(cachePolicies, (cachePolicy) => cachePolicy.id),
      upstreamGroups: upstreamGroupsEntity,
    };

    return {
      payload: data,
      replyTo: payload.id,
    };
  }
}
