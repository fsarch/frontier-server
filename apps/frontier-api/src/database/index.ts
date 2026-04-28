import { CachePolicy } from "./entities/cache-policy.entity";
import { CorsPolicy } from "./entities/cors-policy.entity";
import { DomainGroup } from "./entities/domain-group.entity";
import { DomainGroupDomain } from "./entities/domain-group-domain.entity";
import { LogPolicy } from "./entities/log-policy.entity";
import { PathRule } from "./entities/path-rule.entity";
import { RequestLog } from "./entities/request-log.entity";
import { Upstream } from "./entities/upstream.entity";
import { UpstreamGroup } from "./entities/upstream-group.entity";
import { BaseTables1720373216667 } from "./migrations/1720373216667-base-tables";
import { AddCorsPolicyTable1777326431513 } from "./migrations/1777326431513-add-cors-policy-table";
import {
  AddLogPolicyAndRequestLog1777413549156
} from "./migrations/1777413549156-add-log-policy-and-request-log";

export const DATABASE_OPTIONS = {
  entities: [
    CachePolicy,
    CorsPolicy,
    DomainGroup,
    DomainGroupDomain,
    LogPolicy,
    PathRule,
    RequestLog,
    Upstream,
    UpstreamGroup,
  ],
  migrations: [
    BaseTables1720373216667,
    AddCorsPolicyTable1777326431513,
    AddLogPolicyAndRequestLog1777413549156,
  ],
};
