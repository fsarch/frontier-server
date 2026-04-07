import { WorkerConfigSnapshot } from '../types/worker-config.types';

type CompiledUpstream = {
  host: string;
  port: number;
  basePath: string;
};

type CompiledRoute = {
  pathPrefix: string;
  upstreams: CompiledUpstream[];
  cursor: number;
};

type CompiledDomainGroup = {
  routes: CompiledRoute[];
};

export type RouteResolution = {
  upstream: CompiledUpstream;
  pathPrefix: string;
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
        upstream,
        pathPrefix: route.pathPrefix,
      };
    }

    this.debug(`resolve miss: no matching route for domainGroup=${domainGroupId} path=${pathname}`);

    return null;
  }

  private debug(message: string) {
    if (!this.debugEnabled) {
      return;
    }

    console.debug(`[worker][resolve] ${message}`);
  }

  private compile() {
    for (const domainName of this.snapshot.domainGroupDomainsByDomain.ids) {
      const domainRef = this.snapshot.domainGroupDomainsByDomain.entities[domainName];

      if (!domainRef?.domainGroupId) {
        continue;
      }

      this.domainToDomainGroupId.set(domainName.toLowerCase(), domainRef.domainGroupId);
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
          pathPrefix: pathPattern,
          upstreams,
          cursor: 0,
        });
      }

      this.domainGroups.set(domainGroupId, { routes });
    }
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
    ? normalizedBasePath
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

  return normalizedRequestPath.slice(normalizedPrefix.length) || '/';
}

function isDebugEnabled(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'debug';
}

