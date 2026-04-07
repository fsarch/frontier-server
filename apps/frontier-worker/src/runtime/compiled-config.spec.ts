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
});

