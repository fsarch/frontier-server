import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { DomainGroupService } from "../domain-group/domain-group.service.js";
import { DomainService } from "../domain-group/domain/domain.service.js";
import { CachePolicyService } from "../domain-group/cache-policy/cache-policy.service.js";
import { CorsPolicyService } from "../domain-group/cors-policy/cors-policy.service.js";
import { LogPolicyService } from "../domain-group/log-policy/log-policy.service.js";
import { UpstreamGroupService } from "../domain-group/upstream-group/upstream-group.service.js";
import { UpstreamService } from "../domain-group/upstream-group/upstream/upstream.service.js";
import { PathRuleService } from "../domain-group/path-rule/path-rule.service.js";
import { HookService } from "../hooks/hook.service.js";
import { DomainGroup } from "../../database/entities/domain-group.entity.js";
import { DomainGroupDomain } from "../../database/entities/domain-group-domain.entity.js";
import { CachePolicy } from "../../database/entities/cache-policy.entity.js";
import { CorsPolicy } from "../../database/entities/cors-policy.entity.js";
import { LogPolicy } from "../../database/entities/log-policy.entity.js";
import { UpstreamGroup } from "../../database/entities/upstream-group.entity.js";
import { Upstream } from "../../database/entities/upstream.entity.js";
import { PathRule } from "../../database/entities/path-rule.entity.js";
import { Hook } from "../../database/entities/hook.entity.js";


type TEntity<T> = {
  entities: Record<string, T>;
  ids: Array<string>;
};

export type WorkerConfigSnapshot = {
  domainGroups: TEntity<DomainGroup & { pathRules: Array<PathRule> }>;
  domainGroupDomainsByDomain: TEntity<DomainGroupDomain>;
  cachePolicies: TEntity<CachePolicy>;
  corsPolicies: TEntity<CorsPolicy>;
  logPolicies: TEntity<LogPolicy>;
  hooks: TEntity<Hook>;
  upstreamGroups: TEntity<UpstreamGroup & { upstreams: Array<Upstream> }>;
};

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

function normalizePath(pathname: string): string {
  if (!pathname) {
    return '/';
  }

  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;

  return normalized.length > 1 && normalized.endsWith('/')
    ? normalized.slice(0, -1)
    : normalized;
}

@Injectable()
export class WorkerBootstrapService {
  private readonly logger = new Logger(WorkerBootstrapService.name);

  constructor(
    private readonly domainGroupService: DomainGroupService,
    private readonly domainService: DomainService,
    private readonly cachePolicyService: CachePolicyService,
    private readonly corsPolicyService: CorsPolicyService,
    private readonly logPolicyService: LogPolicyService,
    private readonly upstreamGroupService: UpstreamGroupService,
    private readonly upstreamService: UpstreamService,
    private readonly pathRuleService: PathRuleService,
    private readonly hookService: HookService,
  ) {}

  /**
   * Builds a complete snapshot of all worker configuration entities.
   * This is the same logic used by the WebSocket bootstrap handler.
   */
  public async buildSnapshot(): Promise<WorkerConfigSnapshot> {
    const [
      domainGroups,
      domainGroupDomains,
      cachePolicies,
      corsPolicies,
      logPolicies,
      upstreamGroups,
      upstreams,
      pathRules,
      hooks,
    ] = await Promise.all([
      this.domainGroupService.List(),
      this.domainService.List(),
      this.cachePolicyService.List(),
      this.corsPolicyService.List(),
      this.logPolicyService.List(),
      this.upstreamGroupService.List(),
      this.upstreamService.List(),
      this.pathRuleService.List(),
      this.hookService.List(),
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
      corsPolicies: toEntityGroup(corsPolicies, (corsPolicy) => corsPolicy.id),
      logPolicies: toEntityGroup(logPolicies, (logPolicy) => logPolicy.id),
      hooks: toEntityGroup(hooks, (hook) => hook.id),
      upstreamGroups: upstreamGroupsEntity,
    };
  }

  /**
   * Calculates a SHA-256 checksum for the snapshot to detect changes.
   */
  public getSnapshotChecksum(snapshot: WorkerConfigSnapshot): string {
    return createHash('sha256')
      .update(JSON.stringify(snapshot))
      .digest('hex');
  }

  /**
   * Returns the full bootstrap response (version, checksum, snapshot).
   * This matches the WebSocket bootstrap response format.
   */
  public async getBootstrapResponse(configVersion: number, configChecksum: string): Promise<{
    version: number;
    checksum: string;
    snapshot: WorkerConfigSnapshot;
  }> {
    const snapshot = await this.buildSnapshot();
    const checksum = this.getSnapshotChecksum(snapshot);

    // Increment version if checksum changed
    const newChecksum = checksum !== configChecksum;
    const version = newChecksum ? configVersion + 1 : configVersion;
    const finalChecksum = newChecksum ? checksum : configChecksum;

    return {
      version,
      checksum: finalChecksum,
      snapshot,
    };
  }
}
