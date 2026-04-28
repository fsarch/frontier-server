import { Optional } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { RequestLog } from '../database/entities/request-log.entity';

export class RequestLogDto {
  static FromDbo(dbo: RequestLog) {
    const dto = new RequestLogDto();

    dto.id = dbo.id;
    dto.domainGroupId = dbo.domainGroupId;
    dto.pathRuleId = dbo.pathRuleId;
    dto.logPolicyId = dbo.logPolicyId;
    dto.incomingMethod = dbo.incomingMethod;
    dto.incomingUrl = dbo.incomingUrl;
    dto.incomingHeaders = dbo.incomingHeaders;
    dto.upstreamMethod = dbo.upstreamMethod;
    dto.upstreamUrl = dbo.upstreamUrl;
    dto.upstreamHeaders = dbo.upstreamHeaders;
    dto.responseStatusCode = dbo.responseStatusCode;
    dto.requestTimeMs = parseInt(dbo.requestTimeMs as unknown as string, 10);
    dto.expirationTime = dbo.expirationTime;
    dto.creationTime = dbo.creationTime;

    return dto;
  }

  @ApiProperty()
  id: string;

  @ApiProperty()
  domainGroupId: string;

  @ApiProperty()
  pathRuleId: string;

  @ApiProperty()
  logPolicyId: string;

  @ApiProperty()
  incomingMethod: string;

  @ApiProperty()
  incomingUrl: string;

  @ApiProperty({ type: Object })
  incomingHeaders: Record<string, string | string[]>;

  @ApiProperty()
  upstreamMethod: string;

  @ApiProperty()
  upstreamUrl: string;

  @ApiProperty({ type: Object })
  upstreamHeaders: Record<string, string>;

  @ApiProperty()
  responseStatusCode: number;

  @ApiProperty()
  requestTimeMs: number;

  @ApiProperty()
  expirationTime: Date;

  @ApiProperty()
  creationTime: Date;
}

export class RequestLogQueryDto {
  @ApiProperty({ required: false })
  @Optional()
  pathRuleId?: string;

  @ApiProperty({ required: false })
  @Optional()
  logPolicyId?: string;

  @ApiProperty({ required: false, description: 'ISO date-time lower bound' })
  @Optional()
  from?: string;

  @ApiProperty({ required: false, description: 'ISO date-time upper bound' })
  @Optional()
  to?: string;

  @ApiProperty({ required: false, default: 50 })
  @Optional()
  limit?: string;

  @ApiProperty({ required: false, default: 0 })
  @Optional()
  offset?: string;
}

export class WorkerRequestLogCreateDto {
  @ApiProperty()
  domainGroupId: string;

  @ApiProperty()
  pathRuleId: string;

  @ApiProperty()
  logPolicyId: string;

  @ApiProperty()
  incomingMethod: string;

  @ApiProperty()
  incomingUrl: string;

  @ApiProperty({ type: Object })
  incomingHeaders: Record<string, string | string[]>;

  @ApiProperty()
  upstreamMethod: string;

  @ApiProperty()
  upstreamUrl: string;

  @ApiProperty({ type: Object })
  upstreamHeaders: Record<string, string>;

  @ApiProperty()
  responseStatusCode: number;

  @ApiProperty()
  requestTimeMs: number;
}

