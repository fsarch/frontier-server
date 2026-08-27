import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter, TraceIdRatioBasedSampler, type SpanExporter } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter as OTLPTraceExporterHttp } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPTraceExporter as OTLPTraceExporterGrpc } from '@opentelemetry/exporter-trace-otlp-grpc';
import { Metadata } from '@grpc/grpc-js';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { trace, type Tracer } from '@opentelemetry/api';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const DEFAULT_TRACER_NAME = 'frontier-worker';

type ExporterType = 'console' | 'otlp-http' | 'otlp-grpc';

export type TracingConfig = {
  enabled: boolean;
  serviceName: string;
  serviceVersion?: string;
  sampleRatio: number;
  exporter: {
    type: ExporterType;
    url?: string;
    headers?: Record<string, string>;
  };
};

let sdk: NodeSDK | undefined;

// Reads the FRONTIER_WORKER_TRACING_* environment variables - frontier-worker is entirely
// env-var configured (see README.md), so tracing follows the same convention rather than
// pulling in a YAML config file just for this.
export function loadTracingConfigFromEnv(env: NodeJS.ProcessEnv = process.env): TracingConfig {
  const enabled = isTruthy(env.FRONTIER_WORKER_TRACING_ENABLED);
  const type = (env.FRONTIER_WORKER_TRACING_EXPORTER ?? 'console') as ExporterType;

  if (enabled && type !== 'console' && type !== 'otlp-http' && type !== 'otlp-grpc') {
    throw new Error(`invalid FRONTIER_WORKER_TRACING_EXPORTER: ${type}`);
  }

  if (enabled && (type === 'otlp-http' || type === 'otlp-grpc') && !env.FRONTIER_WORKER_TRACING_EXPORTER_URL) {
    throw new Error(`FRONTIER_WORKER_TRACING_EXPORTER_URL is required for exporter type ${type}`);
  }

  return {
    enabled,
    serviceName: env.FRONTIER_WORKER_TRACING_SERVICE_NAME ?? 'frontier-worker',
    serviceVersion: env.FRONTIER_WORKER_TRACING_SERVICE_VERSION,
    sampleRatio: env.FRONTIER_WORKER_TRACING_SAMPLE_RATIO ? Number.parseFloat(env.FRONTIER_WORKER_TRACING_SAMPLE_RATIO) : 1,
    exporter: {
      type,
      url: env.FRONTIER_WORKER_TRACING_EXPORTER_URL,
      headers: parseHeaders(env.FRONTIER_WORKER_TRACING_EXPORTER_HEADERS),
    },
  };
}

function isTruthy(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true';
}

function parseHeaders(value: string | undefined): Record<string, string> | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    throw new Error('FRONTIER_WORKER_TRACING_EXPORTER_HEADERS must be a valid JSON object string');
  }
}

function createExporter(exporterConfig: TracingConfig['exporter']): SpanExporter {
  switch (exporterConfig.type) {
    case 'console':
      return new ConsoleSpanExporter();
    case 'otlp-http':
      return new OTLPTraceExporterHttp({
        url: exporterConfig.url,
        headers: exporterConfig.headers,
      });
    case 'otlp-grpc': {
      const metadata = new Metadata();
      for (const [key, value] of Object.entries(exporterConfig.headers ?? {})) {
        metadata.set(key, value);
      }
      return new OTLPTraceExporterGrpc({
        url: exporterConfig.url,
        metadata,
      });
    }
    default:
      throw new Error(`Tracing exporter type unknown: ${(exporterConfig as { type: string }).type}`);
  }
}

// Must run before the modules it instruments (the raw `http` server and `undici`/global
// `fetch`) are imported - see tracing/register.ts, which is preloaded via `node --import`.
export function initializeTracing(config: TracingConfig = loadTracingConfigFromEnv()): boolean {
  if (sdk) {
    return true;
  }

  if (!config.enabled) {
    return false;
  }

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
      ...(config.serviceVersion ? { [ATTR_SERVICE_VERSION]: config.serviceVersion } : {}),
    }),
    traceExporter: createExporter(config.exporter),
    sampler: new TraceIdRatioBasedSampler(config.sampleRatio),
    instrumentations: [
      // Traces the raw `http.Server` request handled by HttpProxyServer (the data-plane
      // ingress).
      new HttpInstrumentation(),
      // Traces outgoing `undici.fetch`/global `fetch` calls - the upstream forward in
      // HttpProxyServer and the request-log POST in main.ts both go through undici.
      new UndiciInstrumentation(),
    ],
  });

  sdk.start();
  console.log(`[worker] tracing initialized service=${config.serviceName} exporter=${config.exporter.type}`);
  return true;
}

export async function shutdownTracing(): Promise<void> {
  if (!sdk) {
    return;
  }

  const instance = sdk;
  sdk = undefined;
  await instance.shutdown();
}

export function getTracer(name: string = DEFAULT_TRACER_NAME): Tracer {
  return trace.getTracer(name);
}
