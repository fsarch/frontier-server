import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CorsPolicy } from "../../../database/entities/cors-policy.entity";
import { LogPolicy } from "../../../database/entities/log-policy.entity";
import { PathRule } from "../../../database/entities/path-rule.entity";
import { PathRuleCreateDto, PathRuleUpdateDto } from "../../../models/path-rule.model";

@Injectable()
export class PathRuleService {
  constructor(
    @InjectRepository(PathRule)
    private readonly pathRuleRepository: Repository<PathRule>,
    @InjectRepository(CorsPolicy)
    private readonly corsPolicyRepository: Repository<CorsPolicy>,
    @InjectRepository(LogPolicy)
    private readonly logPolicyRepository: Repository<LogPolicy>,
  ) {
  }


  public async Create(
    domainGroupId: string,
    pathRuleDto: PathRuleCreateDto,
  ) {
    await this.ensureCorsPolicyExists(domainGroupId, pathRuleDto.corsPolicyId);
    await this.ensureLogPolicyExists(domainGroupId, pathRuleDto.logPolicyId);

    const createdPathRule = this.pathRuleRepository.create({
      id: crypto.randomUUID(),
      ...pathRuleDto,
      domainGroupId,
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

  public async GetById(domainGroupId: string, id: string): Promise<PathRule> {
    const pathRule = await this.pathRuleRepository.findOne({ where: { id, domainGroupId } });

    if (!pathRule) {
      throw new NotFoundException(`PathRule ${id} not found`);
    }

    return pathRule;
  }

  public async Update(id: string, domainGroupId: string, dto: PathRuleUpdateDto): Promise<PathRule> {
    const pathRule = await this.GetById(domainGroupId, id);
    await this.ensureCorsPolicyExists(domainGroupId, dto.corsPolicyId);
    await this.ensureLogPolicyExists(domainGroupId, dto.logPolicyId);

    Object.assign(pathRule, dto);

    return this.pathRuleRepository.save(pathRule);
  }

  public async Delete(id: string, domainGroupId: string): Promise<void> {
    const pathRule = await this.GetById(domainGroupId, id);
    await this.pathRuleRepository.softDelete(pathRule.id);
  }

  private async ensureCorsPolicyExists(domainGroupId: string, corsPolicyId: string | null | undefined): Promise<void> {
    if (!corsPolicyId) {
      return;
    }

    const corsPolicy = await this.corsPolicyRepository.findOne({
      where: {
        id: corsPolicyId,
        domainGroupId,
      },
    });

    if (!corsPolicy) {
      throw new NotFoundException(`CorsPolicy ${corsPolicyId} not found`);
    }
  }

  private async ensureLogPolicyExists(domainGroupId: string, logPolicyId: string | null | undefined): Promise<void> {
    if (!logPolicyId) {
      return;
    }

    const logPolicy = await this.logPolicyRepository.findOne({
      where: {
        id: logPolicyId,
        domainGroupId,
      },
    });

    if (!logPolicy) {
      throw new NotFoundException(`LogPolicy ${logPolicyId} not found`);
    }
  }
}
