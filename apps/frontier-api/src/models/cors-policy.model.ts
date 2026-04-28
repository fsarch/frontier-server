import { Optional } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { CorsPolicy } from '../database/entities/cors-policy.entity';

export class CorsPolicyDto {
  static FromDbo(dbo: CorsPolicy) {
    const dto = new CorsPolicyDto();

    dto.id = dbo.id;
    dto.domainGroupId = dbo.domainGroupId;
    dto.name = dbo.name;
    dto.enabled = dbo.enabled;
    dto.allowCredentials = dbo.allowCredentials;
    dto.allowedOrigins = dbo.allowedOrigins ?? [];

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
  allowCredentials: boolean;

  @ApiProperty({ type: [String] })
  allowedOrigins: string[];
}

export class CorsPolicyCreateDto {
  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  @Optional()
  enabled?: boolean;

  @ApiProperty({ required: false })
  @Optional()
  allowCredentials?: boolean;

  @ApiProperty({ required: false, type: [String] })
  @Optional()
  allowedOrigins?: string[];
}

export class CorsPolicyUpdateDto {
  @ApiProperty({ required: false })
  @Optional()
  name?: string;

  @ApiProperty({ required: false })
  @Optional()
  enabled?: boolean;

  @ApiProperty({ required: false })
  @Optional()
  allowCredentials?: boolean;

  @ApiProperty({ required: false, type: [String] })
  @Optional()
  allowedOrigins?: string[];
}

