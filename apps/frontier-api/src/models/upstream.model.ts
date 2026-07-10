import { ApiProperty } from "@nestjs/swagger";
import { Upstream } from "../database/entities/upstream.entity.js";

export type UpstreamWithSslOptions = Upstream & {
  sslOptions?: UpstreamSslOptionsDto;
};

export class UpstreamSslOptionsDto {
  @ApiProperty({ default: true })
  sslVerify: boolean;
}

export class UpstreamSslOptionsCreateDto {
  @ApiProperty({ required: false, default: true })
  sslVerify?: boolean;
}

export class UpstreamDto {
  static FromDbo(dbo: UpstreamWithSslOptions) {
    const dto = new UpstreamDto();

    dto.id = dbo.id;
    dto.name = dbo.name;
    dto.host = dbo.host;
    dto.port = dbo.port;
    dto.path = dbo.path;
    dto.protocol = dbo.protocol;
    dto.sslOptions = {
      sslVerify: dbo.sslOptions?.sslVerify ?? true,
    };

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

  @ApiProperty({ enum: ['http', 'https'] })
  protocol: 'http' | 'https';

  @ApiProperty({ type: UpstreamSslOptionsDto })
  sslOptions: UpstreamSslOptionsDto;
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

  @ApiProperty({ enum: ['http', 'https'], required: false, default: 'http' })
  protocol?: 'http' | 'https';

  @ApiProperty({ type: UpstreamSslOptionsCreateDto, required: false })
  sslOptions?: UpstreamSslOptionsCreateDto;
}

export class UpstreamUpdateDto {
  @ApiProperty({ required: false })
  name?: string;

  @ApiProperty({ required: false })
  host?: string;

  @ApiProperty({ required: false })
  port?: number;

  @ApiProperty({ required: false })
  path?: string;

  @ApiProperty({ enum: ['http', 'https'], required: false })
  protocol?: 'http' | 'https';

  @ApiProperty({ type: UpstreamSslOptionsCreateDto, required: false })
  sslOptions?: UpstreamSslOptionsCreateDto;
}
