import { Injectable } from '@nestjs/common';
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Upstream } from "../../../../database/entities/upstream.entity.js";
import { UpstreamSslOptions } from "../../../../database/entities/upstream-ssl-options.entity.js";
import { UpstreamCreateDto, UpstreamWithSslOptions } from "../../../../models/upstream.model.js";

@Injectable()
export class UpstreamService {
  constructor(
    @InjectRepository(Upstream)
    private readonly upstreamRepository: Repository<Upstream>,
    @InjectRepository(UpstreamSslOptions)
    private readonly upstreamSslOptionsRepository: Repository<UpstreamSslOptions>,
  ) {
  }

  public async Create(
    upstreamGroupId: string,
    upstreamDto: UpstreamCreateDto,
  ) {
    const createdUpstream = this.upstreamRepository.create({
      id: crypto.randomUUID(),
      upstreamGroupId,
      name: upstreamDto.name,
      host: upstreamDto.host,
      port: upstreamDto.port,
      path: upstreamDto.path,
      protocol: upstreamDto.protocol ?? 'http',
    });

    const savedUpstream = await this.upstreamRepository.save(createdUpstream);
    await this.upstreamSslOptionsRepository.save(this.upstreamSslOptionsRepository.create({
      id: savedUpstream.id,
      sslVerify: upstreamDto.sslOptions?.sslVerify ?? true,
    }));

    return {
      id: savedUpstream.id,
    };
  }

  public async ListByUpstreamGroupId(
    upstreamGroupId: string,
  ) {
    const upstreams = await this.upstreamRepository.find({
      where: { upstreamGroupId },
    });

    return this.attachSslOptions(upstreams);
  }

  public async List() {
    const upstreams = await this.upstreamRepository.find();
    return this.attachSslOptions(upstreams);
  }

  private async attachSslOptions(upstreams: Upstream[]): Promise<UpstreamWithSslOptions[]> {
    if (upstreams.length === 0) {
      return upstreams;
    }

    const sslOptions = await this.upstreamSslOptionsRepository.find({
      where: upstreams.map((upstream) => ({ id: upstream.id })),
    });
    const sslOptionsByUpstreamId = new Map(sslOptions.map((option) => [option.id, option]));

    return upstreams.map((upstream) => {
      const option = sslOptionsByUpstreamId.get(upstream.id);
      return {
        ...upstream,
        sslOptions: {
          sslVerify: option?.sslVerify ?? true,
        },
      };
    });
  }
}
