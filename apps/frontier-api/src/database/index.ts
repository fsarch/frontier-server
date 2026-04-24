import { CachePolicy } from "./entities/cache-policy.entity";
import { DomainGroup } from "./entities/domain-group.entity";
import { DomainGroupDomain } from "./entities/domain-group-domain.entity";
import { PathRule } from "./entities/path-rule.entity";
import { Upstream } from "./entities/upstream.entity";
import { UpstreamGroup } from "./entities/upstream-group.entity";
import { BaseTables1720373216667 } from "./migrations/1720373216667-base-tables";
import { AddPathRuleCors1777028975450 } from "./migrations/1777028975450-add-path-rule-cors";

export const DATABASE_OPTIONS = {
  entities: [
    CachePolicy,
    DomainGroup,
    DomainGroupDomain,
    PathRule,
    Upstream,
    UpstreamGroup,
  ],
  migrations: [
    BaseTables1720373216667,
    AddPathRuleCors1777028975450,
  ],
};
