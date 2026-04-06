import { Injectable } from '@nestjs/common';
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Upstream } from "../../../../database/entities/upstream.entity";
import { PathRuleCreateDto } from "../../../../models/path-rule.model";
import { UpstreamCreateDto } from "../../../../models/upstream.model";

@Injectable()
export class UpstreamService {
  constructor(
    @InjectRepository(Upstream)
    private readonly upstreamRepository: Repository<Upstream>,
  ) {
  }

  public async Create(
    upstreamGroupId: string,
    upstreamDto: UpstreamCreateDto,
  ) {
    const createdUpstream = this.upstreamRepository.create({
      id: crypto.randomUUID(),
      upstreamGroupId,
      ...upstreamDto,
    });

    const savedUpstream = await this.upstreamRepository.save(createdUpstream);

    return {
      id: savedUpstream.id,
    };
  }

  public async ListByUpstreamGroupId(
    upstreamGroupId: string,
  ) {
    return this.upstreamRepository.find({
      where: { upstreamGroupId },
    });
  }

  public async List() {
    return this.upstreamRepository.find();
  }
}
