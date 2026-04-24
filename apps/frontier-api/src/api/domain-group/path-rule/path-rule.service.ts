import { Injectable } from '@nestjs/common';
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PathRule } from "../../../database/entities/path-rule.entity";
import { PathRuleCreateDto } from "../../../models/path-rule.model";

@Injectable()
export class PathRuleService {
  constructor(
    @InjectRepository(PathRule)
    private readonly pathRuleRepository: Repository<PathRule>,
  ) {
  }


  public async Create(
    domainGroupId: string,
    pathRuleDto: PathRuleCreateDto,
  ) {
    const normalizedCorsAllowedOrigins = (pathRuleDto.corsAllowedOrigins ?? [])
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);

    const createdPathRule = this.pathRuleRepository.create({
      id: crypto.randomUUID(),
      domainGroupId,
      ...pathRuleDto,
      corsAllowedOrigins: normalizedCorsAllowedOrigins,
      corsEnabled: pathRuleDto.corsEnabled === true,
      corsAllowCredentials: pathRuleDto.corsAllowCredentials === true,
    });

    const savedPathRule = await this.pathRuleRepository.save(createdPathRule);

    return {
      id: savedPathRule.id,
    };
  }

  public async ListByDomainGroupId(
    domainGroupId: string,
  ) {
    return this.pathRuleRepository.find({
      where: { domainGroupId },
      order: {
        order: "ASC",
      },
    });
  }

  public async List() {
    return this.pathRuleRepository.find({
      order: {
        order: "ASC",
      },
    });
  }
}
