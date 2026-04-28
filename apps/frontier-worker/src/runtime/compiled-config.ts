import { CorsPolicy, WorkerConfigSnapshot } from '../types/worker-config.types';

type CompiledUpstream = {
  host: string;
  port: number;
  basePath: string;
};

type CompiledRoute = {
  domainGroupId: string;
  pathRuleId: string;
  pathPrefix: string;
  log: CompiledLogPolicy;
  upstreams: CompiledUpstream[];
  cors: CompiledCorsPolicy;
  cursor: number;
};

type CompiledCorsPolicy = {
  enabled: boolean;
  allowCredentials: boolean;
  allowedOrigins: Set<string>;
};

type CompiledLogPolicy = {
  enabled: boolean;
  logPolicyId: string | null;
  retentionTimeSeconds: number;
};

type CompiledDomainGroup = {
  routes: CompiledRoute[];
};

export type RouteResolution = {
  domainGroupId: string;
  pathRuleId: string;
  upstream: CompiledUpstream;
  pathPrefix: string;
  cors: {
    enabled: boolean;
    allowCredentials: boolean;
    allowedOrigins: string[];
  };
  log: {
    enabled: boolean;
    logPolicyId: string | null;
    retentionTimeSeconds: number;
  };
};

export type CompiledRouteDescription = {
  domainGroupId: string;
  domains: string[];
  pathPrefix: string;
  upstreamHost: string;
  upstreamPort: number;
  upstreamBasePath: string;
  upstreamIndex: number;
  upstreamCount: number;
};

export class CompiledWorkerConfig {
  private readonly domainToDomainGroupId = new Map<string, string>();
  private readonly domainGroups = new Map<string, CompiledDomainGroup>();
  private readonly debugEnabled = isDebugEnabled(process.env.FRONTIER_WORKER_DEBUG);

  constructor(private readonly snapshot: WorkerConfigSnapshot) {
    this.compile();
  }

  public resolve(hostHeader: string | undefined, pathname: string): RouteResolution | null {
    if (!hostHeader) {
      this.debug(`resolve miss: missing host header for path=${pathname}`);
      return null;
    }

    const hostname = normalizeHostname(hostHeader);
    const domainGroupId = this.domainToDomainGroupId.get(hostname);

    this.debug(`resolve start: host=${hostHeader} normalizedHost=${hostname} path=${pathname}`);

    if (!domainGroupId) {
      this.debug(`resolve miss: no domain-group mapping for host=${hostname}`);
      return null;
    }

    const domainGroup = this.domainGroups.get(domainGroupId);

    if (!domainGroup) {
      this.debug(`resolve miss: domain-group=${domainGroupId} has no compiled routes`);
      return null;
    }

    for (const route of domainGroup.routes) {
      if (!matchesPathPrefix(pathname, route.pathPrefix)) {
        this.debug(`resolve skip: path=${pathname} does not match prefix=${route.pathPrefix}`);
        continue;
      }

      if (route.upstreams.length === 0) {
        this.debug(`resolve skip: prefix=${route.pathPrefix} has zero upstreams`);
        continue;
      }

      const upstream = route.upstreams[route.cursor % route.upstreams.length];
      route.cursor += 1;

      this.debug(`resolve hit: domainGroup=${domainGroupId} prefix=${route.pathPrefix} upstream=${upstream.host}:${upstream.port}${upstream.basePath} nextCursor=${route.cursor}`);

      return {
        domainGroupId,
        pathRuleId: route.pathRuleId,
        upstream,
        pathPrefix: route.pathPrefix,
        cors: {
          enabled: route.cors.enabled,
          allowCredentials: route.cors.allowCredentials,
          allowedOrigins: [...route.cors.allowedOrigins],
        },
        log: {
          enabled: route.log.enabled,
          logPolicyId: route.log.logPolicyId,
          retentionTimeSeconds: route.log.retentionTimeSeconds,
        },
      };
    }

    this.debug(`resolve miss: no matching route for domainGroup=${domainGroupId} path=${pathname}`);

    return null;
  }

  public describeRoutes(): CompiledRouteDescription[] {
    const descriptions: CompiledRouteDescription[] = [];
    const domainsByDomainGroupId = this.buildDomainsByDomainGroupId();

    for (const [domainGroupId, domainGroup] of this.domainGroups.entries()) {
      const domains = domainsByDomainGroupId.get(domainGroupId) ?? [];

      for (const route of domainGroup.routes) {
        route.upstreams.forEach((upstream, index) => {
          descriptions.push({
            domainGroupId,
            domains,
            pathPrefix: route.pathPrefix,
            upstreamHost: upstream.host,
            upstreamPort: upstream.port,
            upstreamBasePath: upstream.basePath,
            upstreamIndex: index + 1,
            upstreamCount: route.upstreams.length,
          });
        });
      }
    }

    return descriptions;
  }

  private debug(message: string) {
    if (!this.debugEnabled) {
      return;
    }

    console.debug(`[worker][resolve] ${message}`);
  }

  private compile() {
    for (const domainId of this.snapshot.domainGroupDomainsByDomain.ids) {
      const domainRef = this.snapshot.domainGroupDomainsByDomain.entities[domainId];
      const domainName = domainRef?.domainName?.trim().toLowerCase();

      if (!domainRef?.domainGroupId || !domainName) {
        continue;
      }

      this.domainToDomainGroupId.set(domainName, domainRef.domainGroupId);
    }

    for (const domainGroupId of this.snapshot.domainGroups.ids) {
      const domainGroup = this.snapshot.domainGroups.entities[domainGroupId];
      const rules = [...(domainGroup?.pathRules ?? [])]
        .sort((left, right) => left.order - right.order);

      const routes: CompiledRoute[] = [];

      for (const rule of rules) {
        if (!rule.upstreamGroupId) {
          continue;
        }

        const pathPattern = normalizePathPattern(rule.path);

        const upstreamGroup = this.snapshot.upstreamGroups.entities[rule.upstreamGroupId];
        const upstreams = (upstreamGroup?.upstreams ?? [])
          .filter((upstream) => upstream?.host && upstream?.port)
          .map((upstream) => ({
            host: upstream.host,
            port: upstream.port,
            basePath: normalizePath(upstream.path),
          }));

        if (upstreams.length === 0) {
          continue;
        }

        routes.push({
          domainGroupId,
          pathRuleId: rule.id,
          pathPrefix: pathPattern,
          log: compileLogPolicy(rule.logPolicyId ? this.snapshot.logPolicies.entities[rule.logPolicyId] : undefined),
          upstreams,
          cors: compileCorsPolicy(rule.corsPolicyId ? this.snapshot.corsPolicies.entities[rule.corsPolicyId] : undefined),
          cursor: 0,
        });
      }

      this.domainGroups.set(domainGroupId, { routes });
    }
  }

  private buildDomainsByDomainGroupId(): Map<string, string[]> {
    const domainsByDomainGroupId = new Map<string, Set<string>>();

    for (const domainId of this.snapshot.domainGroupDomainsByDomain.ids) {
      const domainRef = this.snapshot.domainGroupDomainsByDomain.entities[domainId];
      const domainName = domainRef?.domainName?.trim().toLowerCase();

      if (!domainRef?.domainGroupId || !domainName) {
        continue;
      }

      const existingDomains = domainsByDomainGroupId.get(domainRef.domainGroupId) ?? new Set<string>();
      existingDomains.add(domainName);
      domainsByDomainGroupId.set(domainRef.domainGroupId, existingDomains);
    }

    const sortedDomainsByDomainGroupId = new Map<string, string[]>();

    for (const [domainGroupId, domains] of domainsByDomainGroupId.entries()) {
      sortedDomainsByDomainGroupId.set(domainGroupId, [...domains].sort((left, right) => left.localeCompare(right)));
    }

    return sortedDomainsByDomainGroupId;
  }
}

function normalizeHostname(hostHeader: string): string {
  return hostHeader.split(':')[0].trim().toLowerCase();
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

export function buildUpstreamPath(basePath: string, pathPrefix: string, requestPath: string): string {
  const normalizedRequestPath = requestPath.startsWith('/') ? requestPath : `/${requestPath}`;
  const normalizedPattern = normalizePathPattern(pathPrefix);
  const suffix = isCatchAllPattern(normalizedPattern) || isSuffixWildcardPattern(normalizedPattern)
    ? normalizedRequestPath
    : buildPrefixRewriteSuffix(normalizedRequestPath, normalizePath(normalizedPattern));
  const normalizedBasePath = normalizePath(basePath);

  if (normalizedBasePath === '/') {
    return suffix.startsWith('/') ? suffix : `/${suffix}`;
  }

  return suffix === '/'
    ? `${normalizedBasePath}/`
    : `${normalizedBasePath}${suffix}`;
}

function matchesPathPrefix(pathname: string, pathPrefix: string): boolean {
  const normalizedPattern = normalizePathPattern(pathPrefix);

  if (isCatchAllPattern(normalizedPattern)) {
    return true;
  }

  if (isSuffixWildcardPattern(normalizedPattern)) {
    return normalizePath(pathname).endsWith(normalizedPattern.slice(1));
  }

  return matchesPrefixPath(pathname, normalizedPattern);
}

function matchesPrefixPath(pathname: string, pathPrefix: string): boolean {
  const normalizedPath = normalizePath(pathname);
  const normalizedPrefix = normalizePath(pathPrefix);

  if (normalizedPrefix === '/') {
    return true;
  }

  return normalizedPath === normalizedPrefix || normalizedPath.startsWith(`${normalizedPrefix}/`);
}

function normalizePathPattern(pathPattern: string): string {
  const trimmedPattern = (pathPattern ?? '').trim();

  if (!trimmedPattern || trimmedPattern === '/' || trimmedPattern === '*') {
    return '*';
  }

  if (trimmedPattern === '/*') {
    return '*';
  }

  if (trimmedPattern.startsWith('*.')) {
    return trimmedPattern;
  }

  if (trimmedPattern.startsWith('/*.')) {
    return `*${trimmedPattern.slice(2)}`;
  }

  if (trimmedPattern.endsWith('/*')) {
    const prefix = trimmedPattern.slice(0, -2);
    return prefix ? normalizePath(prefix) : '*';
  }

  return normalizePath(trimmedPattern);
}

function isCatchAllPattern(pathPattern: string): boolean {
  return pathPattern === '*';
}

function isSuffixWildcardPattern(pathPattern: string): boolean {
  return pathPattern.startsWith('*.');
}

function buildPrefixRewriteSuffix(normalizedRequestPath: string, normalizedPrefix: string): string {
  if (normalizedPrefix === '/') {
    return normalizedRequestPath;
  }

  return normalizedRequestPath.slice(normalizedPrefix.length);
}

function isDebugEnabled(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'debug';
}

function compileCorsPolicy(policy: CorsPolicy | undefined): CompiledCorsPolicy {
  const enabled = policy?.enabled === true;
  const allowCredentials = enabled && policy?.allowCredentials === true;
  const allowedOrigins = new Set<string>();

  for (const origin of policy?.allowedOrigins ?? []) {
    const normalizedOrigin = origin.trim();

    if (!normalizedOrigin) {
      continue;
    }

    allowedOrigins.add(normalizedOrigin);
  }

  return {
    enabled,
    allowCredentials,
    allowedOrigins,
  };
}

function compileLogPolicy(policy: WorkerConfigSnapshot['logPolicies']['entities'][string] | undefined): CompiledLogPolicy {
  return {
    enabled: policy?.enabled === true,
    logPolicyId: policy?.id ?? null,
    retentionTimeSeconds: policy?.retentionTimeSeconds ?? 0,
  };
}

