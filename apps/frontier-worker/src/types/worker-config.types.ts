export type EntityMap<T> = {
  entities: Record<string, T>;
  ids: string[];
};

export type PathRule = {
  id: string;
  domainGroupId: string;
  name: string;
  path: string;
  order: number;
  cachePolicyId: string | null;
  upstreamGroupId: string | null;
  corsPolicyId?: string | null;
};

export type CorsPolicy = {
  id: string;
  domainGroupId: string;
  name: string;
  enabled: boolean;
  allowCredentials: boolean;
  allowedOrigins?: string[];
};

export type DomainGroup = {
  id: string;
  name: string;
  pathRules?: PathRule[];
};

export type DomainGroupDomain = {
  id: string;
  domainGroupId: string;
  domainName: string;
};

export type Upstream = {
  id: string;
  upstreamGroupId: string;
  name: string;
  host: string;
  port: number;
  path: string;
};

export type UpstreamGroup = {
  id: string;
  domainGroupId: string;
  name: string;
  upstreams?: Upstream[];
};

export type WorkerConfigSnapshot = {
  domainGroups: EntityMap<DomainGroup>;
  domainGroupDomainsByDomain: EntityMap<DomainGroupDomain>;
  cachePolicies: EntityMap<unknown>;
  corsPolicies: EntityMap<CorsPolicy>;
  upstreamGroups: EntityMap<UpstreamGroup>;
};

export type BootstrapReply = {
  version: number;
  checksum: string;
  snapshot: WorkerConfigSnapshot;
};

