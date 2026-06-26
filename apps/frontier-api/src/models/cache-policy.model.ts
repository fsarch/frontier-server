import { ApiProperty } from "@nestjs/swagger";
import { CachePolicy } from "../database/entities/cache-policy.entity.js";
import { Optional } from "@nestjs/common";

export class CachePolicyDto {
  static FromDbo(dbo: CachePolicy) {
    const dto = new CachePolicyDto();

    dto.id = dbo.id;
    dto.name = dbo.name;
    dto.enableCacheTags = dbo.enableCacheTags;
    dto.cacheTagsHeader = dbo.cacheTagsHeader;
    dto.defaultTTL = dbo.defaultTTL !== null
      ? parseInt(dbo.defaultTTL as any, 10)
      : null;
    dto.minTTL = dbo.minTTL !== null
      ? parseInt(dbo.minTTL as any, 10)
      : null;
    dto.maxTTL = dbo.maxTTL !== null
      ? parseInt(dbo.maxTTL as any, 10)
      : null;
    dto.divergenceCookies = dbo.divergenceCookies;
    dto.divergenceHeaders = dbo.divergenceHeaders;
    dto.divergenceQueryParameters = dbo.divergenceQueryParameters;
    dto.enableStaleWhileError = dbo.enableStaleWhileError;
    dto.staleWhileErrorTime = dbo.staleWhileErrorTime;
    dto.enableStaleWhileRevalidate = dbo.enableStaleWhileRevalidate;
    dto.staleWhileRevalidateTime = dbo.staleWhileRevalidateTime;

    return dto;
  }

  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  enableCacheTags: boolean;

  @ApiProperty()
  cacheTagsHeader: string | null;

  @ApiProperty()
  defaultTTL: number | null;

  @ApiProperty()
  minTTL: number | null;

  @ApiProperty()
  maxTTL: number | null;

  @ApiProperty()
  divergenceCookies: Array<string> | null;

  @ApiProperty()
  divergenceHeaders: Array<string> | null;

  @ApiProperty()
  divergenceQueryParameters: Array<string> | null;

  @ApiProperty()
  enableStaleWhileError: boolean;

  @ApiProperty()
  staleWhileErrorTime: number | null;

  @ApiProperty()
  enableStaleWhileRevalidate: boolean;

  @ApiProperty()
  staleWhileRevalidateTime: number | null;
}

export class CachePolicyCreateDto {

  @ApiProperty()
  name: string;

  @ApiProperty()
  @Optional()
  enableCacheTags: boolean;

  @ApiProperty()
  @Optional()
  cacheTagsHeader: string | null;

  @ApiProperty()
  @Optional()
  defaultTTL: number | null;

  @ApiProperty()
  @Optional()
  minTTL: number | null;

  @ApiProperty()
  @Optional()
  maxTTL: number | null;

  @ApiProperty()
  @Optional()
  divergenceCookies: Array<string> | null;

  @ApiProperty()
  @Optional()
  divergenceHeaders: Array<string> | null;

  @ApiProperty()
  @Optional()
  divergenceQueryParameters: Array<string> | null;

  @ApiProperty()
  @Optional()
  enableStaleWhileError: boolean;

  @ApiProperty()
  @Optional()
  staleWhileErrorTime: number | null;

  @ApiProperty()
  @Optional()
  enableStaleWhileRevalidate: boolean;

  @ApiProperty()
  @Optional()
  staleWhileRevalidateTime: number | null;
}

export class CachePolicyUpdateDto {
  @ApiProperty()
  @Optional()
  name: string;

  @ApiProperty()
  @Optional()
  enableCacheTags: boolean;

  @ApiProperty()
  @Optional()
  cacheTagsHeader: string | null;

  @ApiProperty()
  @Optional()
  defaultTTL: number | null;

  @ApiProperty()
  @Optional()
  minTTL: number | null;

  @ApiProperty()
  @Optional()
  maxTTL: number | null;

  @ApiProperty()
  @Optional()
  divergenceCookies: Array<string> | null;

  @ApiProperty()
  @Optional()
  divergenceHeaders: Array<string> | null;

  @ApiProperty()
  @Optional()
  divergenceQueryParameters: Array<string> | null;

  @ApiProperty()
  @Optional()
  enableStaleWhileError: boolean;

  @ApiProperty()
  @Optional()
  staleWhileErrorTime: number | null;

  @ApiProperty()
  @Optional()
  enableStaleWhileRevalidate: boolean;

  @ApiProperty()
  @Optional()
  staleWhileRevalidateTime: number | null;
}
