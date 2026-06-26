import { ApiProperty } from "@nestjs/swagger";
import { Upstream } from "../database/entities/upstream.entity.js";

export class UpstreamDto {
  static FromDbo(dbo: Upstream) {
    const dto = new UpstreamDto();

    dto.id = dbo.id;
    dto.name = dbo.name;
    dto.host = dbo.host;
    dto.port = dbo.port;
    dto.path = dbo.path;

    return dto;
  }

  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  host: string;

  @ApiProperty()
  port: number;

  @ApiProperty()
  path: string;
}

export class UpstreamCreateDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  host: string;

  @ApiProperty()
  port: number;

  @ApiProperty()
  path: string;
}
