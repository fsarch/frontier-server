/**
 * Cache-Control Header Parsing und Serialisierung Utilities
 */
import type { HeadersType } from '../../types/http/shared.type.js';
import type { BodyType } from '../../types/http/shared.type.js';

/**
 * Geparste Cache-Control Direktiven
 */
export interface ParsedCacheControl {
  'max-age'?: number;
  's-maxage'?: number;
  'min-fresh'?: number;
  'max-stale'?: number | string;
  public?: boolean;
  private?: boolean;
  'no-cache'?: boolean;
  'no-store'?: boolean;
  'must-revalidate'?: boolean;
  'proxy-revalidate'?: boolean;
  'no-transform'?: boolean;
  [key: string]: string | number | boolean | undefined;
}

/**
 * CompiledCachePolicy Typ für die Cache-Konfiguration
 * Dieser Typ wird hier lokal definiert, um Zirkelabhängigkeiten zu vermeiden.
 * Er sollte identisch mit dem Typ in compiled-config.ts sein.
 */
export type CompiledCachePolicy = {
  enabled: boolean;
  cachePolicyId: string | null;
  minTTL: number;
  maxTTL: number;
  defaultTTL: number;
};

/**
 * ResponseType für HTTP Responses - verwendet den BodyType aus shared.type.ts
 */
export type ResponseType<TBody extends BodyType | null = BodyType | null> = {
  type: 'response';
  statusCode: number;
  statusText: string;
  headers: HeadersType;
  body: TBody;
};

/**
 * Boolean Direktiven (kein Wert)
 */
const BOOLEAN_DIRECTIVES = new Set([
  'public',
  'private',
  'no-cache',
  'no-store',
  'must-revalidate',
  'proxy-revalidate',
  'no-transform',
]);

/**
 * Numeric Direktiven (erwarten einen Integer Wert)
 */
const NUMERIC_DIRECTIVES = new Set([
  'max-age',
  's-maxage',
  'min-fresh',
]);

/**
 * Standard-Reihenfolge für Cache-Control Direktiven
 */
const STANDARD_DIRECTIVE_ORDER = [
  'public',
  'private',
  'no-cache',
  'no-store',
  'max-age',
  's-maxage',
  'min-fresh',
  'max-stale',
  'must-revalidate',
  'proxy-revalidate',
  'no-transform',
];

/**
 * Hilfsfunktion zum Parsen von nicht-negativen Integern
 */
function parseNonNegativeInteger(value: string): number | null {
  // Remove quotes if present
  const trimmed = value.trim().replace(/^"(.*)"$/, '$1');
  const num = Number.parseInt(trimmed, 10);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

/**
 * Parst einen Cache-Control Header Wert
 * Format: "public, max-age=3600, must-revalidate"
 *
 * @param headerValue - Der Cache-Control Header Wert als String
 * @returns Geparste Direktiven als Object
 */
export function parseCacheControl(headerValue: string | undefined): ParsedCacheControl {
  const directives: ParsedCacheControl = {};

  if (!headerValue || typeof headerValue !== 'string') {
    return directives;
  }

  const tokens = headerValue.split(',').map((t) => t.trim());

  for (const token of tokens) {
    if (!token) {
      continue;
    }

    const [name, value] = token.split('=', 2).map((part) => part.trim());
    const lowerName = name.toLowerCase();

    // Boolean directives (no value)
    if (value === undefined) {
      if (BOOLEAN_DIRECTIVES.has(lowerName)) {
        directives[lowerName] = true;
      }
      continue;
    }

    // Numeric directives
    if (NUMERIC_DIRECTIVES.has(lowerName)) {
      const numValue = parseNonNegativeInteger(value);
      if (numValue !== null) {
        directives[lowerName] = numValue;
      }
      continue;
    }

    // max-stale can be a number or "must-revalidate"
    if (lowerName === 'max-stale') {
      if (value.toLowerCase() === '"must-revalidate"') {
        directives[lowerName] = value;
      } else {
        const numValue = parseNonNegativeInteger(value);
        if (numValue !== null) {
          directives[lowerName] = numValue;
        }
      }
      continue;
    }

    // Store other directives as strings
    if (!directives[lowerName]) {
      directives[lowerName] = value;
    }
  }

  return directives;
}

/**
 * Serialisiert Cache-Control Direktiven zu einem Header Wert
 *
 * @param directives - Die zu serialisierenden Direktiven
 * @returns Cache-Control Header Wert als String
 */
export function serializeCacheControl(directives: ParsedCacheControl): string {
  const parts: string[] = [];

  // Process boolean directives in standard order
  for (const key of STANDARD_DIRECTIVE_ORDER) {
    const value = directives[key as keyof ParsedCacheControl];
    if (value === true) {
      parts.push(key);
    } else if (value !== undefined && value !== false && typeof value === 'number') {
      parts.push(`${key}=${value}`);
    } else if (value !== undefined && value !== false && typeof value === 'string') {
      parts.push(`${key}=${value}`);
    }
  }

  // Add any other directives not in standard order
  for (const [key, value] of Object.entries(directives)) {
    if (!STANDARD_DIRECTIVE_ORDER.includes(key) && value !== undefined && value !== false) {
      const displayValue = value === true ? '' : `=${value}`;
      parts.push(`${key}${displayValue}`);
    }
  }

  return parts.join(', ');
}

/**
 * Wendet die CachePolicy auf eine Response an.
 *
 * Logik:
 * - Wenn cachePolicy disabled ist: Response unverändert zurückgeben
 * - Wenn Response bereits Cache-Control mit max-age hat: Wert beibehalten (begrenzt durch min/max)
 *   - Andere Direktiven werden nicht verändert
 * - Wenn Response Cache-Control ohne max-age hat: defaultTTL hinzufügen (begrenzt)
 *   - public wird gesetzt, wenn nicht bereits public/private vorhanden
 * - Wenn Response keinen Cache-Control hat: neuen mit defaultTTL setzen (begrenzt)
 *   - public wird standardmäßig gesetzt
 * - Wenn defaultTTL <= 0 und kein bestehender max-age: kein Cache-Control Header
 *
 * @param response - Die zu verarbeitende Response
 * @param cachePolicy - Die anzuwendende CachePolicy
 * @returns Response mit angepasstem Cache-Control Header
 */
export function applyCachePolicyToResponse<TBody extends BodyType | null>(
  response: ResponseType<TBody>,
  cachePolicy: CompiledCachePolicy,
): ResponseType<TBody> {
  if (!cachePolicy.enabled) {
    return response;
  }

  // Check if response already has cache-control header
  const cacheControlHeaders = response.headers['cache-control'] ?? [];
  const existingHeader = cacheControlHeaders[0];

  let parsed: ParsedCacheControl = {};
  let hasExistingMaxAge = false;
  let effectiveMaxAge: number | undefined;

  if (existingHeader) {
    parsed = parseCacheControl(existingHeader);
    hasExistingMaxAge = parsed['max-age'] !== undefined;
    effectiveMaxAge = parsed['max-age'];
  }

  // Determine the max-age value to use
  let maxAge = effectiveMaxAge;

  if (!hasExistingMaxAge) {
    // Use defaultTTL as fallback when no max-age exists
    maxAge = cachePolicy.defaultTTL;
  }

  // Apply min/max constraints
  if (maxAge !== undefined) {
    if (cachePolicy.minTTL !== undefined && maxAge < cachePolicy.minTTL) {
      maxAge = cachePolicy.minTTL;
    }
    if (cachePolicy.maxTTL !== undefined  && maxAge > cachePolicy.maxTTL) {
      maxAge = cachePolicy.maxTTL;
    }
  }

  // If we have a valid max-age, ensure it's in the directives
  if (maxAge !== undefined && maxAge >= 0) {
    parsed['max-age'] = maxAge;
    // Only add public directive if there's no existing cache-control header
    // If there is an existing header, preserve its visibility directives
    if (!existingHeader) {
      // No existing cache-control, this is a new one - add public for shared caching
      if (!parsed.public && !parsed.private) {
        parsed.public = true;
      }
    }
    // If there is an existing header, we keep its public/private as-is
  } else {
    // No valid max-age, don't set cache-control
    return response;
  }

  // Serialize the updated cache-control header
  const newCacheControl = serializeCacheControl(parsed);

  if (!newCacheControl) {
    return response;
  }

  // Create new headers with updated cache-control
  const headers = { ...response.headers };
  headers['cache-control'] = [newCacheControl];

  return {
    ...response,
    headers,
  };
}

/**
 * CacheControl Utilities Object
 */
export const CacheControlUtils = {
  parseCacheControl,
  serializeCacheControl,
  applyCachePolicyToResponse,
};
