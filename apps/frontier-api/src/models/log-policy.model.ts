import { Optional } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { LogPolicy } from '../database/entities/log-policy.entity';

export class LogPolicyDto {
  static FromDbo(dbo: LogPolicy) {
    const dto = new LogPolicyDto();

    dto.id = dbo.id;
    dto.domainGroupId = dbo.domainGroupId;
    dto.name = dbo.name;
    dto.enabled = dbo.enabled;
    dto.retentionTimeSeconds = parseInt(dbo.retentionTimeSeconds as unknown as string, 10);

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

  @ApiProperty()
  retentionTimeSeconds: number;
}

export class LogPolicyCreateDto {
  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  @Optional()
  enabled?: boolean;

  @ApiProperty({ required: false })
  @Optional()
  retentionTimeSeconds?: number;
}

export class LogPolicyUpdateDto {
  @ApiProperty({ required: false })
  @Optional()
  name?: string;

  @ApiProperty({ required: false })
  @Optional()
  enabled?: boolean;

  @ApiProperty({ required: false })
  @Optional()
  retentionTimeSeconds?: number;
}

