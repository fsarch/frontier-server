import { CachePolicy } from "./entities/cache-policy.entity.js";
import { CorsPolicy } from "./entities/cors-policy.entity.js";
import { DomainGroup } from "./entities/domain-group.entity.js";
import { DomainGroupDomain } from "./entities/domain-group-domain.entity.js";
import { Hook } from "./entities/hook.entity.js";
import { LogPolicy } from "./entities/log-policy.entity.js";
import { PathRule } from "./entities/path-rule.entity.js";
import { RequestLog } from "./entities/request-log.entity.js";
import { Upstream } from "./entities/upstream.entity.js";
import { UpstreamGroup } from "./entities/upstream-group.entity.js";
import { BaseTables1720373216667 } from "./migrations/1720373216667-base-tables.js";
import { AddCorsPolicyTable1777326431513 } from "./migrations/1777326431513-add-cors-policy-table.js";
import {
  AddLogPolicyAndRequestLog1777413549156
} from "./migrations/1777413549156-add-log-policy-and-request-log.js";
import { AddHookTableAndPathRuleHookIds1782845914875 } from "./migrations/1782845914875-add-hook-table-and-path-rule-hook-ids.js";

export const DATABASE_OPTIONS = {
  entities: [
    CachePolicy,
    CorsPolicy,
    DomainGroup,
    DomainGroupDomain,
    Hook,
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
    AddHookTableAndPathRuleHookIds1782845914875,
  ],
};
