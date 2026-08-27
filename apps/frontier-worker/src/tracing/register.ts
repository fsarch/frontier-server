// Preload entrypoint for OpenTelemetry tracing, loaded via `node --import ./dist/tracing/register.js`
// (see package.json scripts and Dockerfile). This has to happen as a separate `--import`ed module
// rather than a normal import at the top of main.ts: frontier-worker is ESM, and instrumenting
// built-in/ESM-imported modules (like `http` and `undici`) requires the OpenTelemetry loader hook
// to be registered via `module.register()` *before* those modules are first imported anywhere in
// the process - which `--import` guarantees, a plain import in main.ts would not.
import { register } from 'node:module';

register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);

const { initializeTracing } = await import('./tracing.js');

initializeTracing();
