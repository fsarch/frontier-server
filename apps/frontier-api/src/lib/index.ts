import { DATABASE_OPTIONS } from '../database/index.js';
import { FrontierApiModule } from './frontier-api.module.js';

export { FrontierApiModule };
export const entities = DATABASE_OPTIONS.entities;
export const migrations = DATABASE_OPTIONS.migrations;

/**
 * The frozen equivalent of this service's standalone `main.ts` builder
 * calls (`.enableAuth().addSwagger({...})`), as data — see
 * `@fsarch/server`'s `ServiceMountDescriptor`. A mono-service harness
 * spreads this into `.addService({ id, ...descriptor })`; the standalone
 * `main.ts` keeps calling the builder methods directly (no behavior
 * change), just sourcing its values from here instead of duplicating them.
 * No `uac` entry: the standalone app never calls `.enableUac()` today,
 * despite `config.template.yml` carrying a `uac:` section and some
 * controllers having dormant `Role`-based `@Roles()` metadata — pre-existing
 * and out of scope here, so the descriptor mirrors actual current
 * behavior, not the template.
 */
export const descriptor = {
  module: FrontierApiModule,
  entities,
  migrations,
  swagger: {
    title: 'Frontier-API-Server',
    description:
      'The Frontier API-Server is a utility service for configuring and managing the frontier-workers',
    version: '1.0',
  },
  auth: true,
};
