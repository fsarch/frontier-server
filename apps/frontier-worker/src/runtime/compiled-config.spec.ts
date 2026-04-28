import { buildUpstreamPath, CompiledWorkerConfig } from './compiled-config';
import { WorkerConfigSnapshot } from '../types/worker-config.types';

function createSnapshot(): WorkerConfigSnapshot {
  return {
    domainGroups: {
      ids: ['dg-1'],
      entities: {
        'dg-1': {
          id: 'dg-1',
          name: 'main',
          pathRules: [
            {
              id: 'rule-1',
              domainGroupId: 'dg-1',
              name: 'api',
              path: '/api',
              order: 1,
              cachePolicyId: null,
              upstreamGroupId: 'ug-1',
            },
            {
              id: 'rule-2',
              domainGroupId: 'dg-1',
              name: 'root',
              path: '/',
              order: 100,
              cachePolicyId: null,
              upstreamGroupId: 'ug-2',
            },
          ],
        },
      },
    },
    domainGroupDomainsByDomain: {
      ids: ['example.com'],
      entities: {
        'example.com': {
          id: 'dgd-1',
          domainGroupId: 'dg-1',
          domainName: 'example.com',
        },
      },
    },
    cachePolicies: {
      ids: [],
      entities: {},
    },
    corsPolicies: {
      ids: [],
      entities: {},
    },
    logPolicies: {
      ids: [],
      entities: {},
    },
    upstreamGroups: {
      ids: ['ug-1', 'ug-2'],
      entities: {
        'ug-1': {
          id: 'ug-1',
          domainGroupId: 'dg-1',
          name: 'api-upstreams',
          upstreams: [
            {
              id: 'up-1',
              upstreamGroupId: 'ug-1',
              name: 'api-service',
              host: 'api.internal',
              port: 8081,
              path: '/backend',
            },
          ],
        },
        'ug-2': {
          id: 'ug-2',
          domainGroupId: 'dg-1',
          name: 'root-upstreams',
          upstreams: [
            {
              id: 'up-2',
              upstreamGroupId: 'ug-2',
              name: 'frontend-service',
              host: 'frontend.internal',
              port: 8082,
              path: '/',
            },
          ],
        },
      },
    },
  };
}

describe('CompiledWorkerConfig', () => {
  it('matches exact domain and longest configured prefix by order', () => {
    const config = new CompiledWorkerConfig(createSnapshot());

    const route = config.resolve('example.com', '/api/users');

    expect(route).not.toBeNull();
    expect(route?.upstream.host).toBe('api.internal');
    expect(route?.pathPrefix).toBe('/api');
  });

  it('does not treat /api as match for /apiary', () => {
    const config = new CompiledWorkerConfig(createSnapshot());

    const route = config.resolve('example.com', '/apiary');

    expect(route).not.toBeNull();
    expect(route?.upstream.host).toBe('frontend.internal');
    expect(route?.pathPrefix).toBe('*');
  });

  it('matches wildcard * as catch-all', () => {
    const snapshot = createSnapshot();
    snapshot.domainGroups.entities['dg-1'].pathRules = [
      {
        id: 'rule-1',
        domainGroupId: 'dg-1',
        name: 'catch-all',
        path: '*',
        order: 1,
        cachePolicyId: null,
        upstreamGroupId: 'ug-2',
      },
    ];

    const config = new CompiledWorkerConfig(snapshot);
    const route = config.resolve('example.com', '/test');

    expect(route).not.toBeNull();
    expect(route?.pathPrefix).toBe('*');
    expect(route?.upstream.host).toBe('frontend.internal');
  });

  it('matches wildcard /* as catch-all', () => {
    const snapshot = createSnapshot();
    snapshot.domainGroups.entities['dg-1'].pathRules = [
      {
        id: 'rule-1',
        domainGroupId: 'dg-1',
        name: 'catch-all-slash',
        path: '/*',
        order: 1,
        cachePolicyId: null,
        upstreamGroupId: 'ug-2',
      },
    ];

    const config = new CompiledWorkerConfig(snapshot);
    const route = config.resolve('example.com', '/test/nested');

    expect(route).not.toBeNull();
    expect(route?.pathPrefix).toBe('*');
    expect(route?.upstream.host).toBe('frontend.internal');
  });

  it('matches suffix wildcard *.html', () => {
    const snapshot = createSnapshot();
    snapshot.domainGroups.entities['dg-1'].pathRules = [
      {
        id: 'rule-1',
        domainGroupId: 'dg-1',
        name: 'html-only',
        path: '*.html',
        order: 1,
        cachePolicyId: null,
        upstreamGroupId: 'ug-1',
      },
      {
        id: 'rule-2',
        domainGroupId: 'dg-1',
        name: 'fallback',
        path: '/',
        order: 100,
        cachePolicyId: null,
        upstreamGroupId: 'ug-2',
      },
    ];

    const config = new CompiledWorkerConfig(snapshot);
    const htmlRoute = config.resolve('example.com', '/assets/index.html');
    const jsRoute = config.resolve('example.com', '/assets/index.js');

    expect(htmlRoute?.pathPrefix).toBe('*.html');
    expect(htmlRoute?.upstream.host).toBe('api.internal');

    expect(jsRoute?.pathPrefix).toBe('*');
    expect(jsRoute?.upstream.host).toBe('frontend.internal');
  });

  it('matches /dashboard/* for /dashboard and nested paths', () => {
    const snapshot = createSnapshot();
    snapshot.domainGroups.entities['dg-1'].pathRules = [
      {
        id: 'rule-1',
        domainGroupId: 'dg-1',
        name: 'dashboard',
        path: '/dashboard/*',
        order: 1,
        cachePolicyId: null,
        upstreamGroupId: 'ug-1',
      },
    ];

    const config = new CompiledWorkerConfig(snapshot);

    const routeWithSlash = config.resolve('example.com', '/dashboard/');
    const routeWithoutSlash = config.resolve('example.com', '/dashboard');
    const routeNested = config.resolve('example.com', '/dashboard/stats');

    expect(routeWithSlash?.pathPrefix).toBe('/dashboard');
    expect(routeWithoutSlash?.pathPrefix).toBe('/dashboard');
    expect(routeNested?.pathPrefix).toBe('/dashboard');
    expect(routeNested?.upstream.host).toBe('api.internal');
  });

  it('does not match /dashboard/* for /dashboardx', () => {
    const snapshot = createSnapshot();
    snapshot.domainGroups.entities['dg-1'].pathRules = [
      {
        id: 'rule-1',
        domainGroupId: 'dg-1',
        name: 'dashboard',
        path: '/dashboard/*',
        order: 1,
        cachePolicyId: null,
        upstreamGroupId: 'ug-1',
      },
      {
        id: 'rule-2',
        domainGroupId: 'dg-1',
        name: 'fallback',
        path: '/',
        order: 100,
        cachePolicyId: null,
        upstreamGroupId: 'ug-2',
      },
    ];

    const config = new CompiledWorkerConfig(snapshot);
    const route = config.resolve('example.com', '/dashboardx');

    expect(route?.pathPrefix).toBe('*');
    expect(route?.upstream.host).toBe('frontend.internal');
  });

  it('describes compiled routes for startup logging', () => {
    const config = new CompiledWorkerConfig(createSnapshot());

    const routes = config.describeRoutes();

    expect(routes).toEqual([
      {
        domainGroupId: 'dg-1',
        domains: ['example.com'],
        pathPrefix: '/api',
        upstreamHost: 'api.internal',
        upstreamPort: 8081,
        upstreamBasePath: '/backend',
        upstreamIndex: 1,
        upstreamCount: 1,
      },
      {
        domainGroupId: 'dg-1',
        domains: ['example.com'],
        pathPrefix: '*',
        upstreamHost: 'frontend.internal',
        upstreamPort: 8082,
        upstreamBasePath: '/',
        upstreamIndex: 1,
        upstreamCount: 1,
      },
    ]);
  });

  it('uses domainName for host mapping even when entity ids are opaque', () => {
    const snapshot = createSnapshot();
    snapshot.domainGroupDomainsByDomain = {
      ids: ['dgd-1'],
      entities: {
        'dgd-1': {
          id: 'dgd-1',
          domainGroupId: 'dg-1',
          domainName: 'VB3D.DE',
        },
      },
    };

    const config = new CompiledWorkerConfig(snapshot);
    const route = config.resolve('vb3d.de', '/api/users');
    const descriptions = config.describeRoutes();

    expect(route).not.toBeNull();
    expect(route?.upstream.host).toBe('api.internal');
    expect(descriptions[0].domains).toEqual(['vb3d.de']);
  });

  it('compiles and resolves cors policy per matched rule', () => {
    const snapshot = createSnapshot();
    snapshot.domainGroups.entities['dg-1'].pathRules = [
      {
        id: 'rule-1',
        domainGroupId: 'dg-1',
        name: 'api',
        path: '/api',
        order: 1,
        cachePolicyId: null,
        upstreamGroupId: 'ug-1',
        corsPolicyId: 'cp-1',
      },
    ];
    snapshot.corsPolicies = {
      ids: ['cp-1'],
      entities: {
        'cp-1': {
          id: 'cp-1',
          domainGroupId: 'dg-1',
          name: 'frontend-app',
          enabled: true,
          allowCredentials: true,
          allowedOrigins: ['https://app.example.com', '*'],
        },
      },
    };

    const config = new CompiledWorkerConfig(snapshot);
    const route = config.resolve('example.com', '/api/users');

    expect(route).not.toBeNull();
    expect(route?.cors.enabled).toBe(true);
    expect(route?.cors.allowCredentials).toBe(true);
    expect(route?.cors.allowedOrigins).toEqual(['https://app.example.com', '*']);
  });

  it('compiles and resolves log policy per matched rule', () => {
    const snapshot = createSnapshot();
    snapshot.domainGroups.entities['dg-1'].pathRules = [
      {
        id: 'rule-1',
        domainGroupId: 'dg-1',
        name: 'api',
        path: '/api',
        order: 1,
        cachePolicyId: null,
        upstreamGroupId: 'ug-1',
        logPolicyId: 'lp-1',
      },
    ];
    snapshot.logPolicies = {
      ids: ['lp-1'],
      entities: {
        'lp-1': {
          id: 'lp-1',
          domainGroupId: 'dg-1',
          name: 'requests',
          enabled: true,
          retentionTimeSeconds: 3600,
        },
      },
    };

    const config = new CompiledWorkerConfig(snapshot);
    const route = config.resolve('example.com', '/api/users');

    expect(route).not.toBeNull();
    expect(route?.log.enabled).toBe(true);
    expect(route?.log.logPolicyId).toBe('lp-1');
    expect(route?.domainGroupId).toBe('dg-1');
    expect(route?.pathRuleId).toBe('rule-1');
  });
});

describe('buildUpstreamPath', () => {
  it('joins root upstream paths without duplicate slashes', () => {
    expect(buildUpstreamPath('/', '/', '/hello')).toBe('/hello');
  });

  it('rewrites prefixed routes onto upstream base paths', () => {
    expect(buildUpstreamPath('/backend', '/api', '/api/users')).toBe('/backend/users');
  });

  it('keeps full path for catch-all wildcard routes', () => {
    expect(buildUpstreamPath('/backend', '*', '/test')).toBe('/backend/test');
  });

  it('keeps full path for suffix wildcard routes', () => {
    expect(buildUpstreamPath('/backend', '*.html', '/assets/index.html')).toBe('/backend/assets/index.html');
  });

  it('rewrites prefix wildcard routes like /dashboard/* to upstream base path', () => {
    expect(buildUpstreamPath('/app', '/dashboard/*', '/dashboard')).toBe('/app');
    expect(buildUpstreamPath('/app', '/dashboard/*', '/dashboard/')).toBe('/app/');
    expect(buildUpstreamPath('/app', '/dashboard/*', '/dashboard/stats')).toBe('/app/stats');
  });
});

