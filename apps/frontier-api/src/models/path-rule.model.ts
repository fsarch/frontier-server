import { ApiProperty } from "@nestjs/swagger";
import { PathRule } from "../database/entities/path-rule.entity";
import { Optional } from "@nestjs/common";

export class PathRuleDto {
  static FromDbo(dbo: PathRule) {
    const dto = new PathRuleDto();

    dto.id = dbo.id;
    dto.name = dbo.name;
    dto.path = dbo.path;
    dto.cachePolicyId = dbo.cachePolicyId;
    dto.domainGroupId = dbo.domainGroupId;
    dto.upstreamGroupId = dbo.upstreamGroupId;
    dto.order = dbo.order;
    dto.corsEnabled = dbo.corsEnabled;
    dto.corsAllowCredentials = dbo.corsAllowCredentials;
    dto.corsAllowedOrigins = dbo.corsAllowedOrigins ?? [];

    return dto;
  }

  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  path: string;

  @ApiProperty()
  cachePolicyId: string;

  @ApiProperty()
  domainGroupId: string;

  @ApiProperty()
  upstreamGroupId: string;

  @ApiProperty()
  order: number;

  @ApiProperty({ required: false })
  corsEnabled: boolean;

  @ApiProperty({ required: false })
  corsAllowCredentials: boolean;

  @ApiProperty({ required: false, type: [String] })
  corsAllowedOrigins: string[];
}

export class PathRuleCreateDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  path: string;

  @ApiProperty()
  cachePolicyId: string;

  @ApiProperty()
  domainGroupId: string;

  @ApiProperty()
  upstreamGroupId: string;

  @ApiProperty()
  @Optional()
  order: number;

  @ApiProperty({ required: false })
  @Optional()
  corsEnabled?: boolean;

  @ApiProperty({ required: false })
  @Optional()
  corsAllowCredentials?: boolean;

  @ApiProperty({ required: false, type: [String] })
  @Optional()
  corsAllowedOrigins?: string[];
}
