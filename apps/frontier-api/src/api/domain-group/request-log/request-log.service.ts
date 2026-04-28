import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Between, FindOptionsWhere, LessThan, MoreThan, Repository } from 'typeorm';
import { RequestLog } from '../../../database/entities/request-log.entity';
import { RequestLogQueryDto, WorkerRequestLogCreateDto } from '../../../models/request-log.model';
import { LogPolicy } from '../../../database/entities/log-policy.entity';

@Injectable()
export class RequestLogService {
  constructor(
    @InjectRepository(RequestLog)
    private readonly requestLogRepository: Repository<RequestLog>,
    @InjectRepository(LogPolicy)
    private readonly logPolicyRepository: Repository<LogPolicy>,
  ) {
  }

  public async Create(createDto: WorkerRequestLogCreateDto): Promise<{ id: string }> {
    const retentionSec = await this.getRetentionSeconds(createDto.logPolicyId);
    const expirationTime = new Date(Date.now() + (retentionSec * 1000));

    const createdLog = this.requestLogRepository.create({
      id: crypto.randomUUID(),
      domainGroupId: createDto.domainGroupId,
      pathRuleId: createDto.pathRuleId,
      logPolicyId: createDto.logPolicyId,
      incomingMethod: createDto.incomingMethod,
      incomingUrl: createDto.incomingUrl,
      incomingHeaders: createDto.incomingHeaders,
      upstreamMethod: createDto.upstreamMethod,
      upstreamUrl: createDto.upstreamUrl,
      upstreamHeaders: createDto.upstreamHeaders,
      responseStatusCode: createDto.responseStatusCode,
      requestTimeMs: Math.max(0, Math.floor(createDto.requestTimeMs)),
      expirationTime,
    });

    const savedLog = await this.requestLogRepository.save(createdLog);

    return {
      id: savedLog.id,
    };
  }

  public async ListByDomainGroupId(domainGroupId: string, query: RequestLogQueryDto): Promise<RequestLog[]> {
    const where: FindOptionsWhere<RequestLog> = {
      domainGroupId,
    };

    if (query.pathRuleId) {
      where.pathRuleId = query.pathRuleId;
    }

    if (query.logPolicyId) {
      where.logPolicyId = query.logPolicyId;
    }

    const fromDate = parseDate(query.from);
    const toDate = parseDate(query.to);

    if (fromDate && toDate) {
      where.creationTime = Between(fromDate, toDate);
    } else if (fromDate) {
      where.creationTime = MoreThan(fromDate);
    } else if (toDate) {
      where.creationTime = LessThan(toDate);
    }

    const take = parsePositiveInt(query.limit, 50, 1, 200);
    const skip = parsePositiveInt(query.offset, 0, 0, Number.MAX_SAFE_INTEGER);

    return this.requestLogRepository.find({
      where,
      order: {
        creationTime: 'DESC',
      },
      take,
      skip,
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  public async cleanupExpiredLogs(): Promise<void> {
    await this.requestLogRepository.delete({
      expirationTime: LessThan(new Date()),
    });
  }

  private async getRetentionSeconds(logPolicyId: string): Promise<number> {
    const logPolicy = await this.logPolicyRepository.findOne({
      select: ['retentionTimeSeconds'],
      where: {
        id: logPolicyId,
      },
    });

    if (!logPolicy) {
      return 604800;
    }

    const retention = parseInt(logPolicy.retentionTimeSeconds as unknown as string, 10);
    if (!retention || retention <= 0) {
      return 604800;
    }

    return retention;
  }
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function parsePositiveInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (!raw) {
    return fallback;
  }

  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

