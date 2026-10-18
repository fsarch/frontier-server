import { Optional } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import type { RateLimitKeyType } from '../database/entities/rate-limit-policy.entity.js';
import { RateLimitPolicy } from '../database/entities/rate-limit-policy.entity.js';

export const RATE_LIMIT_KEY_TYPES: ReadonlyArray<RateLimitKeyType> = ['ip'];

export class RateLimitPolicyDto {
  static FromDbo(dbo: RateLimitPolicy) {
    const dto = new RateLimitPolicyDto();

    dto.id = dbo.id;
    dto.domainGroupId = dbo.domainGroupId;
    dto.name = dbo.name;
    dto.enabled = dbo.enabled;
    dto.limit = dbo.limit;
    dto.windowSeconds = dbo.windowSeconds;
    dto.keyType = dbo.keyType;

    return dto;
  }

  @ApiProperty()
  id: string;

  @ApiProperty()
  domainGroupId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  enabled: boolean;

  @ApiProperty({ description: 'Maximum number of requests per window' })
  limit: number;

  @ApiProperty({ description: 'Window length in seconds' })
  windowSeconds: number;

  @ApiProperty({ enum: RATE_LIMIT_KEY_TYPES })
  keyType: RateLimitKeyType;
}

export class RateLimitPolicyCreateDto {
  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  @Optional()
  enabled?: boolean;

  @ApiProperty({ description: 'Maximum number of requests per window' })
  limit: number;

  @ApiProperty({ required: false, default: 60 })
  @Optional()
  windowSeconds?: number;

  @ApiProperty({ required: false, enum: RATE_LIMIT_KEY_TYPES, default: 'ip' })
  @Optional()
  keyType?: RateLimitKeyType;
}

export class RateLimitPolicyUpdateDto {
  @ApiProperty({ required: false })
  @Optional()
  name?: string;

  @ApiProperty({ required: false })
  @Optional()
  enabled?: boolean;

  @ApiProperty({ required: false })
  @Optional()
  limit?: number;

  @ApiProperty({ required: false })
  @Optional()
  windowSeconds?: number;

  @ApiProperty({ required: false, enum: RATE_LIMIT_KEY_TYPES })
  @Optional()
  keyType?: RateLimitKeyType;
}
