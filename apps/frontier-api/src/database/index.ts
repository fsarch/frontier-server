import { CachePolicy } from "./entities/cache-policy.entity";
import { CorsPolicy } from "./entities/cors-policy.entity";
import { DomainGroup } from "./entities/domain-group.entity";
import { DomainGroupDomain } from "./entities/domain-group-domain.entity";
import { PathRule } from "./entities/path-rule.entity";
import { Upstream } from "./entities/upstream.entity";
import { UpstreamGroup } from "./entities/upstream-group.entity";
import { BaseTables1720373216667 } from "./migrations/1720373216667-base-tables";
import { AddCorsPolicyTable1777326431513 } from "./migrations/1777326431513-add-cors-policy-table";

export const DATABASE_OPTIONS = {
  entities: [
    CachePolicy,
    CorsPolicy,
    DomainGroup,
    DomainGroupDomain,
    PathRule,
    Upstream,
    UpstreamGroup,
  ],
  migrations: [
    BaseTables1720373216667,
    AddCorsPolicyTable1777326431513,
  ],
};
