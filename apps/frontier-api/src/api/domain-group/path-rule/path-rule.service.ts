import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PathRule } from "../../../database/entities/path-rule.entity";
import { PathRuleCreateDto, PathRuleUpdateDto } from "../../../models/path-rule.model";

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

  public async GetById(id: string): Promise<PathRule> {
    const pathRule = await this.pathRuleRepository.findOne({ where: { id } });

    if (!pathRule) {
      throw new NotFoundException(`PathRule ${id} not found`);
    }

    return pathRule;
  }

  public async Update(id: string, dto: PathRuleUpdateDto): Promise<PathRule> {
    const pathRule = await this.GetById(id);

    if (dto.corsAllowedOrigins !== undefined) {
      dto.corsAllowedOrigins = dto.corsAllowedOrigins
        .map((o) => o.trim())
        .filter((o) => o.length > 0);
    }

    Object.assign(pathRule, dto);

    return this.pathRuleRepository.save(pathRule);
  }

  public async Delete(id: string): Promise<void> {
    const pathRule = await this.GetById(id);
    await this.pathRuleRepository.softDelete(pathRule.id);
  }
}
