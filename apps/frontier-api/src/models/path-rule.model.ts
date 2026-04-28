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
    dto.corsPolicyId = dbo.corsPolicyId ?? null;

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
  corsPolicyId: string | null;
}

export class PathRuleUpdateDto {
  @ApiProperty({ required: false })
  @Optional()
  name?: string;

  @ApiProperty({ required: false })
  @Optional()
  path?: string;

  @ApiProperty({ required: false })
  @Optional()
  cachePolicyId?: string;

  @ApiProperty({ required: false })
  @Optional()
  upstreamGroupId?: string;

  @ApiProperty({ required: false })
  @Optional()
  order?: number;

  @ApiProperty({ required: false })
  @Optional()
  corsPolicyId?: string | null;
}

export class PathRuleCreateDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  path: string;

  @ApiProperty()
  cachePolicyId: string;

  @ApiProperty()
  upstreamGroupId: string;

  @ApiProperty()
  @Optional()
  order: number;

  @ApiProperty({ required: false })
  @Optional()
  corsPolicyId?: string | null;
}
